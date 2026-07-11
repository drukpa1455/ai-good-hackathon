from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import timedelta

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool

from .contracts import ContextGraph, EvidenceRecord
from .live_context import (
    ArtifactReceipt,
    ContextCapacityError,
    LeaseLostError,
    RefreshLease,
    StoredContext,
    StoreStatus,
    context_sha256,
)


class PostgresContextStore:
    def __init__(self, database_url: str) -> None:
        self._pool = AsyncConnectionPool(
            database_url,
            min_size=1,
            max_size=4,
            open=False,
            kwargs={"row_factory": dict_row},
        )

    async def open(self) -> None:
        await self._pool.open()
        try:
            await self._pool.wait(timeout=5)
        except Exception:
            await self._pool.close()
            raise

    async def close(self) -> None:
        await self._pool.close()

    async def get_current(self, parcel_id: str) -> StoredContext | None:
        async with self._pool.connection() as connection:
            cursor = await connection.execute(
                """
                SELECT
                    snapshots.snapshot_sha256,
                    snapshots.parcel_id,
                    snapshots.context,
                    snapshots.published_at
                FROM current_contexts AS current
                JOIN context_snapshots AS snapshots
                  ON snapshots.snapshot_sha256 = current.snapshot_sha256
                WHERE current.parcel_id = %s
                """,
                (parcel_id,),
            )
            row = await cursor.fetchone()
        if row is None:
            return None
        return StoredContext(
            context=_validated_stored_context(row),
            published_at=row["published_at"],
        )

    async def get_evidence(self, evidence_id: str) -> EvidenceRecord | None:
        async with self._pool.connection() as connection:
            cursor = await connection.execute(
                """
                SELECT evidence.record
                FROM current_contexts AS current
                JOIN snapshot_evidence AS evidence
                  ON evidence.snapshot_sha256 = current.snapshot_sha256
                WHERE evidence.evidence_id = %s
                ORDER BY current.updated_at DESC
                LIMIT 1
                """,
                (evidence_id,),
            )
            row = await cursor.fetchone()
        return EvidenceRecord.model_validate(row["record"]) if row else None

    async def acquire_lease(
        self, parcel_id: str, ttl: timedelta
    ) -> RefreshLease | None:
        owner = str(uuid.uuid4())
        async with self._pool.connection() as connection:
            async with connection.transaction():
                await connection.execute(
                    "SELECT id FROM context_store_guard WHERE id = 1 FOR UPDATE"
                )
                existing_cursor = await connection.execute(
                    "SELECT 1 FROM refresh_state WHERE parcel_id = %s",
                    (parcel_id,),
                )
                if await existing_cursor.fetchone() is None:
                    count_cursor = await connection.execute(
                        "SELECT count(*) AS count FROM refresh_state"
                    )
                    count = await count_cursor.fetchone()
                    if count["count"] >= 100:
                        raise ContextCapacityError(
                            "live context store is limited to 100 parcel slots"
                        )
                cursor = await connection.execute(
                    """
                    INSERT INTO refresh_state AS state (
                        parcel_id,
                        lease_owner,
                        lease_generation,
                        lease_expires_at,
                        last_started_at
                    )
                    VALUES (
                        %s,
                        %s,
                        1,
                        clock_timestamp() + (%s * interval '1 second'),
                        clock_timestamp()
                    )
                    ON CONFLICT (parcel_id) DO UPDATE SET
                        lease_owner = EXCLUDED.lease_owner,
                        lease_generation = state.lease_generation + 1,
                        lease_expires_at = EXCLUDED.lease_expires_at,
                        last_started_at = EXCLUDED.last_started_at
                    WHERE state.lease_expires_at IS NULL
                       OR state.lease_expires_at <= clock_timestamp()
                    RETURNING
                        parcel_id,
                        lease_owner::text AS lease_owner,
                        lease_generation,
                        lease_expires_at
                    """,
                    (parcel_id, owner, ttl.total_seconds()),
                )
                row = await cursor.fetchone()
        if row is None:
            return None
        return RefreshLease(
            parcel_id=row["parcel_id"],
            owner=row["lease_owner"],
            generation=row["lease_generation"],
            expires_at=row["lease_expires_at"],
        )

    async def publish(
        self,
        lease: RefreshLease,
        context: ContextGraph,
        receipts: Sequence[ArtifactReceipt],
    ) -> StoredContext:
        if (
            context.site.parcel_id != lease.parcel_id
            or context.release.mock
            or context.release.data_status != "live"
            or context.focus != "overview"
        ):
            raise ValueError("only the leased parcel's live overview context can be published")
        evidence_by_artifact = {
            (record.dataset_id, record.artifact_sha256): record for record in context.evidence
        }
        receipt_by_artifact = {(item.dataset_id, item.sha256): item for item in receipts}
        if len(receipt_by_artifact) != len(receipts) or set(receipt_by_artifact) != set(
            evidence_by_artifact
        ):
            raise ValueError("artifact receipts must exactly match context evidence")
        for key, receipt in receipt_by_artifact.items():
            record = evidence_by_artifact[key]
            if (
                receipt.query_url != record.record_url
                or receipt.license_id != record.license_id
                or receipt.retrieved_at.isoformat() != record.retrieved_at
                or (
                    receipt.source_updated_at.isoformat()
                    if receipt.source_updated_at
                    else None
                )
                != record.source_updated_at
            ):
                raise ValueError("artifact receipt provenance does not match context evidence")

        snapshot_sha = context_sha256(context)
        async with self._pool.connection() as connection:
            async with connection.transaction():
                lease_cursor = await connection.execute(
                    """
                    SELECT
                        lease_owner::text AS lease_owner,
                        lease_generation,
                        lease_expires_at > clock_timestamp() AS unexpired
                    FROM refresh_state
                    WHERE parcel_id = %s
                    FOR UPDATE
                    """,
                    (lease.parcel_id,),
                )
                lease_row = await lease_cursor.fetchone()
                if (
                    lease_row is None
                    or lease_row["lease_owner"] != lease.owner
                    or lease_row["lease_generation"] != lease.generation
                    or not lease_row["unexpired"]
                ):
                    raise LeaseLostError("a newer refresh owns this parcel")

                await connection.execute(
                    "SELECT id FROM context_store_guard WHERE id = 1 FOR UPDATE"
                )
                current_cursor = await connection.execute(
                    "SELECT 1 FROM current_contexts WHERE parcel_id = %s",
                    (lease.parcel_id,),
                )
                if await current_cursor.fetchone() is None:
                    count_cursor = await connection.execute(
                        "SELECT count(*) AS count FROM current_contexts"
                    )
                    count = await count_cursor.fetchone()
                    if count["count"] >= 100:
                        raise ContextCapacityError("live context store is limited to 100 parcels")

                for key, receipt in sorted(receipt_by_artifact.items()):
                    await connection.execute(
                        """
                        INSERT INTO source_artifacts (
                            dataset_id,
                            sha256,
                            object_key,
                            byte_count,
                            query_url,
                            license_id,
                            retrieved_at,
                            source_updated_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (dataset_id, sha256, retrieved_at) DO NOTHING
                        """,
                        (
                            receipt.dataset_id,
                            receipt.sha256,
                            receipt.object_key,
                            receipt.byte_count,
                            receipt.query_url,
                            receipt.license_id,
                            receipt.retrieved_at,
                            receipt.source_updated_at,
                        ),
                    )
                    artifact_cursor = await connection.execute(
                        """
                        SELECT
                            object_key,
                            byte_count,
                            query_url,
                            license_id,
                            retrieved_at,
                            source_updated_at
                        FROM source_artifacts
                        WHERE dataset_id = %s AND sha256 = %s AND retrieved_at = %s
                        """,
                        (*key, receipt.retrieved_at),
                    )
                    artifact_row = await artifact_cursor.fetchone()
                    if artifact_row != {
                        "object_key": receipt.object_key,
                        "byte_count": receipt.byte_count,
                        "query_url": receipt.query_url,
                        "license_id": receipt.license_id,
                        "retrieved_at": receipt.retrieved_at,
                        "source_updated_at": receipt.source_updated_at,
                    }:
                        raise ValueError("stored artifact metadata does not match its receipt")

                await connection.execute(
                    """
                    INSERT INTO context_snapshots (
                        snapshot_sha256,
                        parcel_id,
                        graph_release_id,
                        context,
                        source_cutoff_at
                    ) VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (snapshot_sha256) DO NOTHING
                    """,
                    (
                        snapshot_sha,
                        lease.parcel_id,
                        context.release.id,
                        Jsonb(context.model_dump(mode="json")),
                        context.release.source_cutoff_at,
                    ),
                )
                for record in context.evidence:
                    await connection.execute(
                        """
                        INSERT INTO snapshot_evidence (
                            snapshot_sha256,
                            evidence_id,
                            dataset_id,
                            artifact_sha256,
                            artifact_retrieved_at,
                            record
                        ) VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (snapshot_sha256, evidence_id) DO NOTHING
                        """,
                        (
                            snapshot_sha,
                            record.id,
                            record.dataset_id,
                            record.artifact_sha256,
                            record.retrieved_at,
                            Jsonb(record.model_dump(mode="json")),
                        ),
                    )
                await connection.execute(
                    """
                    INSERT INTO current_contexts (parcel_id, snapshot_sha256, updated_at)
                    VALUES (%s, %s, clock_timestamp())
                    ON CONFLICT (parcel_id) DO UPDATE SET
                        snapshot_sha256 = EXCLUDED.snapshot_sha256,
                        updated_at = EXCLUDED.updated_at
                    """,
                    (lease.parcel_id, snapshot_sha),
                )
                await connection.execute(
                    """
                    DELETE FROM context_snapshots
                    WHERE snapshot_sha256 IN (
                        SELECT snapshot_sha256
                        FROM context_snapshots
                        WHERE parcel_id = %s
                        ORDER BY published_at DESC, snapshot_sha256 DESC
                        OFFSET 10
                    )
                    """,
                    (lease.parcel_id,),
                )
                await connection.execute(
                    """
                    DELETE FROM source_artifacts AS artifacts
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM snapshot_evidence AS evidence
                        WHERE evidence.dataset_id = artifacts.dataset_id
                          AND evidence.artifact_sha256 = artifacts.sha256
                          AND evidence.artifact_retrieved_at = artifacts.retrieved_at
                    )
                    """
                )
                completed = await connection.execute(
                    """
                    UPDATE refresh_state SET
                        lease_owner = NULL,
                        lease_expires_at = NULL,
                        last_completed_at = clock_timestamp(),
                        last_error_code = NULL
                    WHERE parcel_id = %s
                      AND lease_owner = %s
                      AND lease_generation = %s
                      AND lease_expires_at > clock_timestamp()
                    """,
                    (lease.parcel_id, lease.owner, lease.generation),
                )
                if completed.rowcount != 1:
                    raise LeaseLostError("a newer refresh owns this parcel")
                published_cursor = await connection.execute(
                    """
                    SELECT published_at
                    FROM context_snapshots
                    WHERE snapshot_sha256 = %s
                    """,
                    (snapshot_sha,),
                )
                published = await published_cursor.fetchone()
        return StoredContext(context=context, published_at=published["published_at"])

    async def fail_refresh(
        self, lease: RefreshLease, error_code: str, *, retain_status: bool
    ) -> None:
        async with self._pool.connection() as connection:
            if retain_status:
                await connection.execute(
                    """
                    UPDATE refresh_state SET
                        lease_owner = NULL,
                        lease_expires_at = NULL,
                        last_error_code = %s
                    WHERE parcel_id = %s
                      AND lease_owner = %s
                      AND lease_generation = %s
                    """,
                    (error_code, lease.parcel_id, lease.owner, lease.generation),
                )
            else:
                await connection.execute(
                    """
                    DELETE FROM refresh_state
                    WHERE parcel_id = %s
                      AND lease_owner = %s
                      AND lease_generation = %s
                      AND NOT EXISTS (
                          SELECT 1 FROM current_contexts
                          WHERE current_contexts.parcel_id = refresh_state.parcel_id
                      )
                    """,
                    (lease.parcel_id, lease.owner, lease.generation),
                )

    async def get_statuses(self, parcel_ids: Sequence[str]) -> list[StoreStatus]:
        if not parcel_ids:
            return []
        async with self._pool.connection() as connection:
            cursor = await connection.execute(
                """
                SELECT
                    ids.parcel_id,
                    snapshots.snapshot_sha256,
                    snapshots.context,
                    snapshots.published_at,
                    (state.lease_expires_at > clock_timestamp()) AS refreshing,
                    state.last_started_at,
                    state.last_completed_at,
                    state.last_error_code
                FROM unnest(%s::text[]) AS ids(parcel_id)
                LEFT JOIN current_contexts AS current USING (parcel_id)
                LEFT JOIN context_snapshots AS snapshots
                  ON snapshots.snapshot_sha256 = current.snapshot_sha256
                LEFT JOIN refresh_state AS state USING (parcel_id)
                """,
                (list(parcel_ids),),
            )
            rows = await cursor.fetchall()
        return [
            StoreStatus(
                parcel_id=row["parcel_id"],
                context=(
                    _validated_stored_context(row) if row["context"] else None
                ),
                published_at=row["published_at"],
                refreshing=bool(row["refreshing"]),
                last_started_at=row["last_started_at"],
                last_completed_at=row["last_completed_at"],
                last_error_code=row["last_error_code"],
            )
            for row in rows
        ]


def _validated_stored_context(row) -> ContextGraph:
    context = ContextGraph.model_validate(row["context"])
    if (
        context_sha256(context) != row["snapshot_sha256"]
        or context.site.parcel_id != row["parcel_id"]
        or context.release.mock
        or context.release.data_status != "live"
        or context.focus != "overview"
    ):
        raise ValueError("stored live context failed its integrity check")
    return context
