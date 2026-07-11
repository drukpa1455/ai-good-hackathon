from __future__ import annotations

import asyncio
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

import pytest

from groundwork.contracts import ContextGraph, EvidenceRecord, Point
from groundwork.datasf import (
    DATASET_REGISTRY,
    DataSFArtifact,
    DataSFCompiler,
    DataSFQuery,
    dependent_queries,
    parcel_query,
)
from groundwork.live_context import (
    ArtifactReceipt,
    ContextCapacityError,
    LiveContextService,
    LiveContextUnavailableError,
    RefreshLease,
    StoredContext,
    StoreStatus,
)
from groundwork.repository import JsonReleaseRepository, NotFoundError

NOW = datetime(2026, 7, 11, 12, 0, tzinfo=UTC)
PARCEL_ID = "3956008"
PARCEL_ROW = {
    "blklot": PARCEL_ID,
    "block_num": "3956",
    "lot_num": "008",
    "from_address_num": "300",
    "street_name": "DE HARO",
    "street_type": "ST",
    "active": True,
    "centroid_latitude": "37.765725",
    "centroid_longitude": "-122.402024",
}


class FakeDataSFClient:
    def __init__(
        self,
        *,
        delay: float = 0,
        fail_dataset: str | None = None,
        missing_parcel: bool = False,
    ) -> None:
        self.delay = delay
        self.fail_dataset = fail_dataset
        self.missing_parcel = missing_parcel
        self.calls: list[str] = []
        self.active = 0
        self.max_active = 0

    async def fetch(self, query: DataSFQuery) -> DataSFArtifact:
        self.calls.append(query.dataset_id)
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        try:
            if self.delay:
                await asyncio.sleep(self.delay)
            if query.dataset_id == self.fail_dataset:
                raise RuntimeError("injected source failure")
            rows = (
                []
                if query.dataset_id != "acdm-wktn" or self.missing_parcel
                else [PARCEL_ROW]
            )
            return DataSFArtifact.from_rows(
                dataset_id=query.dataset_id,
                query_url=query.url,
                retrieved_at=NOW,
                source_updated_at=NOW,
                rows=rows,
            )
        finally:
            self.active -= 1


class FakeArtifactStore:
    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.calls: list[str] = []

    async def put(self, artifact: DataSFArtifact) -> ArtifactReceipt:
        self.calls.append(artifact.dataset_id)
        if self.fail:
            raise RuntimeError("injected Spaces failure")
        return ArtifactReceipt(
            dataset_id=artifact.dataset_id,
            sha256=artifact.artifact_sha256,
            object_key=(
                f"datasf/{artifact.dataset_id}/{artifact.artifact_sha256}.json"
            ),
            byte_count=len(str(artifact.rows).encode()),
            query_url=artifact.query_url,
            license_id=DATASET_REGISTRY[artifact.dataset_id].license_id,
            retrieved_at=artifact.retrieved_at,
            source_updated_at=artifact.source_updated_at,
        )


class FakeContextStore:
    def __init__(
        self,
        *,
        now: datetime,
        current: StoredContext | None = None,
        lease_available: bool = True,
        capacity_reached: bool = False,
        missing_evidence: bool = False,
        evidence_error: bool = False,
    ) -> None:
        self.now = now
        self.current = current
        self.lease_available = lease_available
        self.capacity_reached = capacity_reached
        self.missing_evidence = missing_evidence
        self.evidence_error = evidence_error
        self.acquire_calls = 0
        self.published = 0
        self.failed: list[str] = []
        self.retained_failure_status: list[bool] = []
        self.last_receipts: Sequence[ArtifactReceipt] = ()

    async def open(self) -> None:
        return None

    async def close(self) -> None:
        return None

    async def get_current(self, parcel_id: str) -> StoredContext | None:
        del parcel_id
        return self.current

    async def get_evidence(self, evidence_id: str) -> EvidenceRecord | None:
        if self.evidence_error:
            raise RuntimeError("injected evidence store failure")
        if self.missing_evidence:
            return None
        if self.current is None:
            return None
        return next(
            (record for record in self.current.context.evidence if record.id == evidence_id),
            None,
        )

    async def acquire_lease(
        self, parcel_id: str, ttl: timedelta
    ) -> RefreshLease | None:
        self.acquire_calls += 1
        if self.capacity_reached:
            raise ContextCapacityError("injected capacity")
        if not self.lease_available:
            return None
        return RefreshLease(
            parcel_id=parcel_id,
            owner="00000000-0000-0000-0000-000000000001",
            generation=1,
            expires_at=self.now + ttl,
        )

    async def publish(
        self,
        lease: RefreshLease,
        context: ContextGraph,
        receipts: Sequence[ArtifactReceipt],
    ) -> StoredContext:
        assert lease.parcel_id == context.site.parcel_id
        self.published += 1
        self.last_receipts = receipts
        self.current = StoredContext(context=context, published_at=self.now)
        return self.current

    async def fail_refresh(
        self, lease: RefreshLease, error_code: str, *, retain_status: bool
    ) -> None:
        del lease
        self.failed.append(error_code)
        self.retained_failure_status.append(retain_status)

    async def get_statuses(self, parcel_ids: Sequence[str]) -> list[StoreStatus]:
        return [
            StoreStatus(
                parcel_id=parcel_id,
                context=self.current.context if self.current else None,
                published_at=self.current.published_at if self.current else None,
                refreshing=False,
                last_started_at=self.now if self.acquire_calls else None,
                last_completed_at=self.now if self.published else None,
                last_error_code=self.failed[-1] if self.failed else None,
            )
            for parcel_id in parcel_ids
        ]


def _artifacts(compiled_at: datetime = NOW) -> tuple[DataSFArtifact, ...]:
    parcel = DataSFArtifact.from_rows(
        dataset_id="acdm-wktn",
        query_url=parcel_query(PARCEL_ID).url,
        retrieved_at=NOW,
        source_updated_at=NOW,
        rows=[PARCEL_ROW],
    )
    centroid = Point(longitude=-122.402024, latitude=37.765725)
    dependent = tuple(
        DataSFArtifact.from_rows(
            dataset_id=query.dataset_id,
            query_url=query.url,
            retrieved_at=NOW,
            source_updated_at=NOW,
            rows=[],
        )
        for query in dependent_queries(PARCEL_ID, centroid, compiled_at)
    )
    return (parcel, *dependent)


def _live_graph(compiled_at: datetime = NOW) -> ContextGraph:
    return DataSFCompiler().compile(_artifacts(compiled_at), compiled_at)


def _service(
    repository: JsonReleaseRepository,
    store: FakeContextStore,
    *,
    client: FakeDataSFClient | None = None,
    artifact_store: FakeArtifactStore | None = None,
    timeout: float = 8,
) -> tuple[LiveContextService, FakeDataSFClient, FakeArtifactStore]:
    resolved_client = client or FakeDataSFClient()
    resolved_artifacts = artifact_store or FakeArtifactStore()
    return (
        LiveContextService(
            fixture=repository,
            client=resolved_client,
            compiler=DataSFCompiler(),
            contexts=store,
            artifacts=resolved_artifacts,
            clock=lambda: NOW,
            fetch_timeout_seconds=timeout,
        ),
        resolved_client,
        resolved_artifacts,
    )


def test_fresh_context_returns_without_refresh(repository: JsonReleaseRepository) -> None:
    graph = _live_graph()
    store = FakeContextStore(
        now=NOW,
        current=StoredContext(graph, NOW - timedelta(minutes=1)),
    )
    service, client, _artifacts_store = _service(repository, store)
    result = asyncio.run(service.get_context(PARCEL_ID, "overview"))
    assert result.release.data_status == "live"
    assert result.release.mock is False
    assert client.calls == []
    assert store.acquire_calls == 0


def test_lease_loser_serves_stale_or_fixture(repository: JsonReleaseRepository) -> None:
    graph = _live_graph()
    stale_store = FakeContextStore(
        now=NOW,
        current=StoredContext(graph, NOW - timedelta(minutes=16)),
        lease_available=False,
    )
    stale_service, _, _ = _service(repository, stale_store)
    stale = asyncio.run(stale_service.get_context(PARCEL_ID, "overview"))
    assert stale.release.data_status == "stale"
    assert stale.release.mock is False

    empty_store = FakeContextStore(now=NOW, lease_available=False)
    fixture_service, _, _ = _service(repository, empty_store)
    fixture = asyncio.run(fixture_service.get_context(PARCEL_ID, "overview"))
    assert fixture.release.data_status == "fixture"
    assert fixture.release.mock is True


def test_refresh_fetches_seven_queries_with_four_way_concurrency(
    repository: JsonReleaseRepository,
) -> None:
    store = FakeContextStore(now=NOW)
    client = FakeDataSFClient(delay=0.005)
    service, _, artifact_store = _service(repository, store, client=client)
    result = asyncio.run(service.get_context(PARCEL_ID, "overview"))

    assert result.release.data_status == "live"
    assert client.calls[0] == "acdm-wktn"
    assert sorted(client.calls) == sorted(DATASET_REGISTRY)
    assert client.max_active == 4
    assert sorted(artifact_store.calls) == sorted(DATASET_REGISTRY)
    assert store.published == 1
    assert len(store.last_receipts) == 7
    evidence = asyncio.run(service.get_evidence(f"ev-acdm-wktn-{PARCEL_ID}"))
    assert evidence.dataset_id == "acdm-wktn"


def test_refresh_failure_serves_stale_then_fixture(
    repository: JsonReleaseRepository,
) -> None:
    graph = _live_graph()
    stale_store = FakeContextStore(
        now=NOW,
        current=StoredContext(graph, NOW - timedelta(minutes=16)),
    )
    stale_service, _, _ = _service(
        repository,
        stale_store,
        client=FakeDataSFClient(fail_dataset="i98e-djp9"),
    )
    stale = asyncio.run(stale_service.get_context(PARCEL_ID, "overview"))
    assert stale.release.data_status == "stale"
    assert stale_store.failed == ["refresh_failed"]
    assert stale_store.retained_failure_status == [True]

    empty_store = FakeContextStore(now=NOW)
    fixture_service, _, _ = _service(
        repository,
        empty_store,
        artifact_store=FakeArtifactStore(fail=True),
    )
    fixture = asyncio.run(fixture_service.get_context(PARCEL_ID, "overview"))
    assert fixture.release.data_status == "fixture"
    assert empty_store.failed == ["refresh_failed"]
    assert empty_store.retained_failure_status == [True]


def test_timeout_is_bounded_and_missing_arbitrary_context_fails_closed(
    repository: JsonReleaseRepository,
) -> None:
    timeout_store = FakeContextStore(now=NOW)
    timeout_service, _, _ = _service(
        repository,
        timeout_store,
        client=FakeDataSFClient(delay=0.05),
        timeout=0.01,
    )
    fixture = asyncio.run(timeout_service.get_context(PARCEL_ID, "overview"))
    assert fixture.release.data_status == "fixture"
    assert timeout_store.failed == ["datasf_timeout"]

    no_lease = FakeContextStore(now=NOW, lease_available=False)
    arbitrary_service, _, _ = _service(repository, no_lease)
    with pytest.raises(LiveContextUnavailableError):
        asyncio.run(arbitrary_service.get_context("9999999", "overview"))

    missing_store = FakeContextStore(now=NOW)
    missing_service, _, _ = _service(
        repository,
        missing_store,
        client=FakeDataSFClient(missing_parcel=True),
    )
    with pytest.raises(NotFoundError, match="No active DataSF parcel"):
        asyncio.run(missing_service.get_context("9999999", "overview"))
    assert missing_store.retained_failure_status == [False]


def test_capacity_is_enforced_before_fetch_or_artifact_upload(
    repository: JsonReleaseRepository,
) -> None:
    store = FakeContextStore(now=NOW, capacity_reached=True)
    service, client, artifacts = _service(repository, store)
    fixture = asyncio.run(service.get_context(PARCEL_ID, "overview"))
    assert fixture.release.data_status == "fixture"
    assert client.calls == []
    assert artifacts.calls == []


def test_evidence_never_crosses_from_live_to_fixture_provenance(
    repository: JsonReleaseRepository,
) -> None:
    graph = _live_graph()
    live = StoredContext(graph, NOW)
    missing_store = FakeContextStore(now=NOW, current=live, missing_evidence=True)
    missing_service, _, _ = _service(repository, missing_store)
    with pytest.raises(LiveContextUnavailableError, match="does not contain"):
        asyncio.run(missing_service.get_evidence(f"ev-acdm-wktn-{PARCEL_ID}"))

    error_store = FakeContextStore(now=NOW, current=live, evidence_error=True)
    error_service, _, _ = _service(repository, error_store)
    with pytest.raises(LiveContextUnavailableError, match="unavailable"):
        asyncio.run(error_service.get_evidence(f"ev-acdm-wktn-{PARCEL_ID}"))

    fixture_store = FakeContextStore(now=NOW)
    fixture_service, _, _ = _service(repository, fixture_store)
    fixture = asyncio.run(
        fixture_service.get_evidence(f"ev-acdm-wktn-{PARCEL_ID}")
    )
    assert fixture.license_id == "demo-fixture"


def test_data_status_reports_live_age_and_last_failure(
    repository: JsonReleaseRepository,
) -> None:
    graph = _live_graph()
    store = FakeContextStore(
        now=NOW,
        current=StoredContext(graph, NOW - timedelta(minutes=16)),
    )
    store.failed.append("datasf_timeout")
    service, _, _ = _service(repository, store)
    status = asyncio.run(service.data_status([PARCEL_ID]))
    assert status.live_data_enabled is True
    assert status.sites[0].status == "stale"
    assert status.sites[0].last_error_code == "datasf_timeout"
