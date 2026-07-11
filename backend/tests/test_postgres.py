from __future__ import annotations

import asyncio
import os
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path

import psycopg
import pytest

from groundwork.contracts import ContextGraph, Point
from groundwork.datasf import (
    DATASET_REGISTRY,
    DataSFArtifact,
    DataSFCompiler,
    canonical_projection_bytes,
    dependent_queries,
    parcel_query,
)
from groundwork.live_context import (
    ArtifactReceipt,
    ContextCapacityError,
    LeaseLostError,
    RefreshLease,
)
from groundwork.migrate import apply_migrations
from groundwork.postgres import PostgresContextStore
from groundwork.repository import JsonReleaseRepository

NOW = datetime(2026, 7, 11, 12, 0, tzinfo=UTC)
INTEGRATION_APN = "9999999"
UNSEEDED_INTEGRATION_APNS = ("9999998", "9999997")
INTEGRATION_NOW = datetime(2099, 1, 1, 0, 0, tzinfo=UTC)


class FakeCursor:
    rowcount = 1

    def __init__(self, row):
        self.row = row

    async def fetchone(self):
        return self.row


class AsyncContext:
    def __init__(self, value) -> None:
        self.value = value

    async def __aenter__(self):
        return self.value

    async def __aexit__(self, *_args):
        return False


class ExpiredLeaseConnection:
    def __init__(self, lease: RefreshLease) -> None:
        self.lease = lease
        self.calls: list[str] = []

    def transaction(self) -> AsyncContext:
        return AsyncContext(self)

    async def execute(self, query: str, _parameters=None):
        self.calls.append(query)
        if "FROM refresh_state" not in query or "FOR UPDATE" not in query:
            raise AssertionError("publish continued after an expired fence")
        return FakeCursor(
            {
                "lease_owner": self.lease.owner,
                "lease_generation": self.lease.generation,
                "unexpired": False,
            }
        )


class FakePool:
    def __init__(self, connection: ExpiredLeaseConnection) -> None:
        self.connection_value = connection

    def connection(self) -> AsyncContext:
        return AsyncContext(self.connection_value)


class FullCapacityConnection:
    def __init__(self) -> None:
        self.calls: list[str] = []

    def transaction(self) -> AsyncContext:
        return AsyncContext(self)

    async def execute(self, query: str, _parameters=None):
        self.calls.append(query)
        if "context_store_guard" in query:
            return FakeCursor({"id": 1})
        if "SELECT 1 FROM refresh_state" in query:
            return FakeCursor(None)
        if "count(*) AS count FROM refresh_state" in query:
            return FakeCursor({"count": 100})
        raise AssertionError("capacity check allowed a lease insert")


def _live_fixture() -> ContextGraph:
    root = Path(__file__).resolve().parents[2]
    repository = JsonReleaseRepository.load(root / "data/releases/demo-v1")
    payload = repository.get_context("3956008", "overview").model_dump(mode="json")
    payload["release"].update(
        {
            "id": "live-postgres-test",
            "compiler_version": "datasf-test",
            "mock": False,
            "data_status": "live",
        }
    )
    payload["trust"]["graph_release_id"] = "live-postgres-test"
    for record in payload["evidence"]:
        record["record_url"] = record["source_url"]
    return ContextGraph.model_validate(payload)


def _receipts(context: ContextGraph) -> list[ArtifactReceipt]:
    return [
        ArtifactReceipt(
            dataset_id=record.dataset_id,
            sha256=record.artifact_sha256,
            object_key=f"datasf/{record.dataset_id}/{record.artifact_sha256}.json",
            byte_count=2,
            query_url=record.record_url or record.source_url,
            license_id=record.license_id,
            retrieved_at=datetime.fromisoformat(record.retrieved_at),
            source_updated_at=(
                datetime.fromisoformat(record.source_updated_at)
                if record.source_updated_at
                else None
            ),
        )
        for record in context.evidence
    ]


def _integration_artifacts(compiled_at: datetime) -> tuple[DataSFArtifact, ...]:
    parcel = DataSFArtifact.from_rows(
        dataset_id="acdm-wktn",
        query_url=parcel_query(INTEGRATION_APN).url,
        retrieved_at=compiled_at,
        source_updated_at=compiled_at,
        rows=[
            {
                "blklot": INTEGRATION_APN,
                "block_num": "9999",
                "lot_num": "999",
                "active": True,
                "centroid_latitude": "37.75",
                "centroid_longitude": "-122.45",
            }
        ],
    )
    return (
        parcel,
        *(
            DataSFArtifact.from_rows(
                dataset_id=query.dataset_id,
                query_url=query.url,
                retrieved_at=compiled_at,
                source_updated_at=compiled_at,
                rows=[],
            )
            for query in dependent_queries(
                INTEGRATION_APN,
                Point(longitude=-122.45, latitude=37.75),
                compiled_at,
            )
        ),
    )


def _artifact_receipts(
    artifacts: Sequence[DataSFArtifact], context: ContextGraph
) -> list[ArtifactReceipt]:
    evidence = {record.dataset_id: record for record in context.evidence}
    return [
        ArtifactReceipt(
            dataset_id=artifact.dataset_id,
            sha256=artifact.artifact_sha256,
            object_key=(
                f"datasf/{artifact.dataset_id}/{artifact.artifact_sha256}.json"
            ),
            byte_count=len(canonical_projection_bytes(artifact.rows)),
            query_url=artifact.query_url,
            license_id=DATASET_REGISTRY[artifact.dataset_id].license_id,
            retrieved_at=artifact.retrieved_at,
            source_updated_at=artifact.source_updated_at,
        )
        for artifact in artifacts
        if evidence[artifact.dataset_id].artifact_sha256 == artifact.artifact_sha256
    ]


async def _cleanup_integration_data(database_url: str) -> None:
    async with await psycopg.AsyncConnection.connect(database_url) as connection:
        await connection.execute(
            "DELETE FROM current_contexts WHERE parcel_id = %s",
            (INTEGRATION_APN,),
        )
        await connection.execute(
            "DELETE FROM context_snapshots WHERE parcel_id = %s",
            (INTEGRATION_APN,),
        )
        await connection.execute(
            "DELETE FROM refresh_state WHERE parcel_id = %s",
            (INTEGRATION_APN,),
        )
        cursor = connection.cursor()
        await cursor.executemany(
            """
            DELETE FROM source_artifacts
            WHERE dataset_id = %s AND sha256 = %s AND retrieved_at = %s
            """,
            [
                (
                    artifact.dataset_id,
                    artifact.artifact_sha256,
                    artifact.retrieved_at,
                )
                for offset in range(11)
                for artifact in _integration_artifacts(
                    INTEGRATION_NOW + timedelta(seconds=offset)
                )
            ],
        )


def test_expired_lease_cannot_publish_even_without_a_successor() -> None:
    context = _live_fixture()
    lease = RefreshLease(
        parcel_id="3956008",
        owner="00000000-0000-0000-0000-000000000001",
        generation=4,
        expires_at=NOW,
    )
    connection = ExpiredLeaseConnection(lease)
    store = PostgresContextStore.__new__(PostgresContextStore)
    store._pool = FakePool(connection)  # type: ignore[assignment]

    with pytest.raises(LeaseLostError):
        asyncio.run(store.publish(lease, context, _receipts(context)))
    assert len(connection.calls) == 1
    assert "lease_expires_at > clock_timestamp()" in connection.calls[0]


def test_full_parcel_capacity_rejects_before_creating_a_lease() -> None:
    connection = FullCapacityConnection()
    store = PostgresContextStore.__new__(PostgresContextStore)
    store._pool = FakePool(connection)  # type: ignore[assignment]
    with pytest.raises(ContextCapacityError):
        asyncio.run(store.acquire_lease("9999999", timedelta(seconds=20)))
    assert len(connection.calls) == 3
    assert all("INSERT INTO refresh_state" not in query for query in connection.calls)


@pytest.mark.skipif(
    not os.getenv("TEST_DATABASE_URL"),
    reason="TEST_DATABASE_URL enables the real PostgreSQL migration/lease probe",
)
def test_real_postgres_migration_and_lease_probe() -> None:
    database_url = os.environ["TEST_DATABASE_URL"]

    async def scenario() -> None:
        await apply_migrations(database_url)
        await apply_migrations(database_url)

        await _cleanup_integration_data(database_url)
        compiler = DataSFCompiler()
        async with await psycopg.AsyncConnection.connect(database_url) as connection:
            await connection.execute(
                "DELETE FROM refresh_state WHERE parcel_id = %s",
                (INTEGRATION_APN,),
            )
        store = PostgresContextStore(database_url)
        await store.open()
        try:
            for offset in range(11):
                compiled_at = INTEGRATION_NOW + timedelta(seconds=offset)
                artifacts = _integration_artifacts(compiled_at)
                context = compiler.compile(artifacts, compiled_at)
                lease = await store.acquire_lease(INTEGRATION_APN, timedelta(seconds=20))
                assert lease is not None
                assert (
                    await store.acquire_lease(INTEGRATION_APN, timedelta(seconds=20))
                    is None
                )
                await store.publish(lease, context, _artifact_receipts(artifacts, context))
        finally:
            await store.close()

        restarted = PostgresContextStore(database_url)
        await restarted.open()
        try:
            current = await restarted.get_current(INTEGRATION_APN)
            assert current is not None
            assert current.context.release.id == context.release.id
            evidence = await restarted.get_evidence(f"ev-acdm-wktn-{INTEGRATION_APN}")
            assert evidence is not None
            assert evidence.parcel_ids == [INTEGRATION_APN]
            statuses = await restarted.get_statuses([INTEGRATION_APN])
            assert len(statuses) == 1
            assert statuses[0].parcel_id == INTEGRATION_APN
            assert statuses[0].context is not None
            assert statuses[0].context.release.id == context.release.id
            assert not statuses[0].refreshing
            all_statuses = await restarted.get_statuses(
                [INTEGRATION_APN, *UNSEEDED_INTEGRATION_APNS]
            )
            all_by_parcel = {item.parcel_id: item for item in all_statuses}
            assert set(all_by_parcel) == {
                INTEGRATION_APN,
                *UNSEEDED_INTEGRATION_APNS,
            }
            assert len(all_statuses) == 3
            assert all(
                all_by_parcel[parcel_id].context is None
                for parcel_id in UNSEEDED_INTEGRATION_APNS
            )
        finally:
            await restarted.close()

        async with await psycopg.AsyncConnection.connect(database_url) as connection:
            cursor = await connection.execute(
                "SELECT count(*) FROM context_snapshots WHERE parcel_id = %s",
                (INTEGRATION_APN,),
            )
            assert (await cursor.fetchone())[0] == 10

    try:
        asyncio.run(scenario())
    finally:
        asyncio.run(_cleanup_integration_data(database_url))
