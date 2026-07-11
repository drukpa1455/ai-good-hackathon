from __future__ import annotations

import asyncio
import hashlib
import inspect
import json
import logging
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol

from .contracts import (
    ContextGraph,
    DataStatusResponse,
    EvidenceRecord,
    SiteDataStatus,
)
from .datasf import (
    DataSFArtifact,
    DataSFClient,
    DataSFCompileError,
    dependent_queries,
    parcel_query,
    parcel_seed,
    validate_parcel_id,
)
from .repository import (
    FOCUS_VALUES,
    InvalidFocusError,
    JsonReleaseRepository,
    NotFoundError,
    filter_by_focus,
)

logger = logging.getLogger(__name__)
Clock = Callable[[], datetime]


class LiveContextUnavailableError(RuntimeError):
    """No trustworthy live or fixture context can be served."""


class LeaseLostError(RuntimeError):
    """A newer refresh owns the right to publish this parcel."""


class ContextCapacityError(RuntimeError):
    """The bounded live-context store has reached its parcel cap."""


@dataclass(frozen=True)
class StoredContext:
    context: ContextGraph
    published_at: datetime


@dataclass(frozen=True)
class RefreshLease:
    parcel_id: str
    owner: str
    generation: int
    expires_at: datetime


@dataclass(frozen=True)
class ArtifactReceipt:
    dataset_id: str
    sha256: str
    object_key: str
    byte_count: int
    query_url: str
    license_id: str
    retrieved_at: datetime
    source_updated_at: datetime | None


@dataclass(frozen=True)
class StoreStatus:
    parcel_id: str
    context: ContextGraph | None
    published_at: datetime | None
    refreshing: bool
    last_started_at: datetime | None
    last_completed_at: datetime | None
    last_error_code: str | None


class ContextStore(Protocol):
    async def open(self) -> None: ...

    async def close(self) -> None: ...

    async def get_current(self, parcel_id: str) -> StoredContext | None: ...

    async def get_evidence(self, evidence_id: str) -> EvidenceRecord | None: ...

    async def acquire_lease(self, parcel_id: str, ttl: timedelta) -> RefreshLease | None: ...

    async def publish(
        self,
        lease: RefreshLease,
        context: ContextGraph,
        receipts: Sequence[ArtifactReceipt],
    ) -> StoredContext: ...

    async def fail_refresh(
        self, lease: RefreshLease, error_code: str, *, retain_status: bool
    ) -> None: ...

    async def get_statuses(self, parcel_ids: Sequence[str]) -> list[StoreStatus]: ...


class ArtifactStore(Protocol):
    async def put(self, artifact: DataSFArtifact) -> ArtifactReceipt: ...


class GraphCompiler(Protocol):
    def compile(
        self,
        artifacts: Sequence[DataSFArtifact],
        compiled_at: datetime,
    ) -> ContextGraph: ...


class LiveContextService:
    def __init__(
        self,
        *,
        fixture: JsonReleaseRepository,
        client: DataSFClient,
        compiler: GraphCompiler,
        contexts: ContextStore,
        artifacts: ArtifactStore,
        clock: Clock | None = None,
        cache_ttl: timedelta = timedelta(minutes=15),
        lease_ttl: timedelta = timedelta(seconds=20),
        fetch_timeout_seconds: float = 8.0,
        concurrency: int = 4,
    ) -> None:
        self._fixture = fixture
        self._client = client
        self._compiler = compiler
        self._contexts = contexts
        self._artifacts = artifacts
        self._clock = clock or (lambda: datetime.now(UTC))
        self._cache_ttl = cache_ttl
        self._lease_ttl = lease_ttl
        self._fetch_timeout_seconds = fetch_timeout_seconds
        self._concurrency = concurrency

    async def open(self) -> None:
        await self._contexts.open()

    async def close(self) -> None:
        await self._contexts.close()
        closer = getattr(self._client, "close", None)
        if closer is not None:
            result = closer()
            if inspect.isawaitable(result):
                await result

    async def get_context(self, parcel_id: str, focus: str) -> ContextGraph:
        parcel_id = _parcel_id(parcel_id)
        if focus not in FOCUS_VALUES:
            raise InvalidFocusError(f"Unknown focus {focus}")

        try:
            current = await self._contexts.get_current(parcel_id)
        except Exception as error:
            _log_refresh_failure(parcel_id, "context_store_unavailable", error)
            return filter_by_focus(self._fixture_or_raise(parcel_id), focus)

        if current is not None and _is_fresh(current.published_at, self._clock(), self._cache_ttl):
            return filter_by_focus(_with_status(current.context, "live"), focus)

        try:
            lease = await self._contexts.acquire_lease(parcel_id, self._lease_ttl)
        except ContextCapacityError as error:
            _log_refresh_failure(parcel_id, "capacity_reached", error)
            return filter_by_focus(self._fallback(parcel_id, current), focus)
        except Exception as error:
            _log_refresh_failure(parcel_id, "context_store_unavailable", error)
            return filter_by_focus(self._fallback(parcel_id, current), focus)

        if lease is None:
            return filter_by_focus(self._fallback(parcel_id, current), focus)

        try:
            context, source_artifacts = await self._fetch_context(parcel_id)
            receipts = await self._put_artifacts(source_artifacts)
            stored = await self._contexts.publish(lease, context, receipts)
            return filter_by_focus(_with_status(stored.context, "live"), focus)
        except Exception as error:
            error_code = _refresh_error_code(error)
            _log_refresh_failure(parcel_id, error_code, error)
            try:
                await self._contexts.fail_refresh(
                    lease,
                    error_code,
                    retain_status=current is not None or self._has_fixture(parcel_id),
                )
            except Exception as release_error:
                _log_refresh_failure(parcel_id, "lease_release_failed", release_error)
            if isinstance(error, NotFoundError) and current is None:
                try:
                    fixture = self._fixture.get_context(parcel_id, "overview")
                except NotFoundError:
                    raise error from None
                return filter_by_focus(_with_status(fixture, "fixture"), focus)
            return filter_by_focus(self._fallback(parcel_id, current), focus)

    async def get_evidence(self, evidence_id: str) -> EvidenceRecord:
        try:
            record = await self._contexts.get_evidence(evidence_id)
        except Exception as error:
            _log_refresh_failure("unknown", "context_store_unavailable", error)
            raise LiveContextUnavailableError("Live evidence store is unavailable") from error
        if record is not None:
            return record
        fixture_record = self._fixture.get_evidence(evidence_id)
        try:
            live_contexts = [
                await self._contexts.get_current(parcel_id)
                for parcel_id in fixture_record.parcel_ids
            ]
        except Exception as error:
            _log_refresh_failure("unknown", "context_store_unavailable", error)
            raise LiveContextUnavailableError("Live evidence store is unavailable") from error
        if any(context is not None for context in live_contexts):
            raise LiveContextUnavailableError(
                "Current live graph does not contain the requested evidence"
            )
        return fixture_record

    async def data_status(self, parcel_ids: Sequence[str]) -> DataStatusResponse:
        now = self._clock()
        try:
            stored = {
                item.parcel_id: item
                for item in await self._contexts.get_statuses(parcel_ids)
            }
        except Exception as error:
            _log_refresh_failure("featured", "context_store_unavailable", error)
            stored = {}

        sites: list[SiteDataStatus] = []
        for parcel_id in parcel_ids:
            item = stored.get(parcel_id)
            fixture = self._fixture.get_context(parcel_id, "overview")
            if item is None:
                sites.append(_fixture_status(fixture, "context_store_unavailable"))
                continue
            if item.refreshing:
                state = "refreshing"
            elif item.context is None:
                state = "fixture"
            elif item.published_at is not None and _is_fresh(
                item.published_at, now, self._cache_ttl
            ):
                state = "live"
            else:
                state = "stale"
            context = item.context or fixture
            sites.append(
                SiteDataStatus(
                    parcel_id=parcel_id,
                    status=state,
                    graph_release_id=context.release.id,
                    published_at=item.published_at.isoformat() if item.published_at else None,
                    source_cutoff_at=context.release.source_cutoff_at,
                    last_refresh_started_at=(
                        item.last_started_at.isoformat() if item.last_started_at else None
                    ),
                    last_refresh_completed_at=(
                        item.last_completed_at.isoformat() if item.last_completed_at else None
                    ),
                    last_error_code=item.last_error_code,
                )
            )
        return DataStatusResponse(live_data_enabled=True, sites=sites)

    async def _fetch_context(
        self, parcel_id: str
    ) -> tuple[ContextGraph, tuple[DataSFArtifact, ...]]:
        compiled_at = self._clock()
        async with asyncio.timeout(self._fetch_timeout_seconds):
            parcel_artifact = await self._client.fetch(parcel_query(parcel_id))
            if not parcel_artifact.rows:
                raise NotFoundError(f"No active DataSF parcel {parcel_id}")
            seed = parcel_seed(parcel_artifact)
            if seed.parcel_id != parcel_id:
                raise DataSFCompileError("parcel query returned a different APN")
            semaphore = asyncio.Semaphore(self._concurrency)

            async def fetch(query):
                async with semaphore:
                    return await self._client.fetch(query)

            async with asyncio.TaskGroup() as group:
                tasks = [
                    group.create_task(fetch(query))
                    for query in dependent_queries(parcel_id, seed.centroid, compiled_at)
                ]
            dependent = tuple(task.result() for task in tasks)
        artifacts = (parcel_artifact, *dependent)
        context = self._compiler.compile(artifacts, compiled_at)
        if (
            context.site.parcel_id != parcel_id
            or context.release.mock
            or context.release.data_status != "live"
            or context.focus != "overview"
        ):
            raise DataSFCompileError("compiler returned an invalid live context")
        return context, artifacts

    async def _put_artifacts(
        self, artifacts: Sequence[DataSFArtifact]
    ) -> tuple[ArtifactReceipt, ...]:
        semaphore = asyncio.Semaphore(self._concurrency)

        async def put(artifact: DataSFArtifact) -> ArtifactReceipt:
            async with semaphore:
                return await self._artifacts.put(artifact)

        async with asyncio.TaskGroup() as group:
            tasks = [group.create_task(put(artifact)) for artifact in artifacts]
        return tuple(task.result() for task in tasks)

    def _fallback(self, parcel_id: str, current: StoredContext | None) -> ContextGraph:
        if current is not None:
            return _with_status(current.context, "stale")
        return self._fixture_or_raise(parcel_id)

    def _fixture_or_raise(self, parcel_id: str) -> ContextGraph:
        try:
            return _with_status(self._fixture.get_context(parcel_id, "overview"), "fixture")
        except NotFoundError as error:
            raise LiveContextUnavailableError(
                f"No usable context is available for parcel {parcel_id}"
            ) from error

    def _has_fixture(self, parcel_id: str) -> bool:
        try:
            self._fixture.get_context(parcel_id, "overview")
        except NotFoundError:
            return False
        return True


def disabled_data_status(
    fixture: JsonReleaseRepository, parcel_ids: Sequence[str]
) -> DataStatusResponse:
    return DataStatusResponse(
        live_data_enabled=False,
        sites=[
            _fixture_status(fixture.get_context(parcel_id, "overview"))
            for parcel_id in parcel_ids
        ],
    )


def canonical_context_bytes(context: ContextGraph) -> bytes:
    return json.dumps(
        context.model_dump(mode="json"),
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def context_sha256(context: ContextGraph) -> str:
    return hashlib.sha256(canonical_context_bytes(context)).hexdigest()


def _parcel_id(value: str) -> str:
    try:
        return validate_parcel_id(value)
    except ValueError as error:
        raise NotFoundError(f"No site with parcel id {value}") from error


def _with_status(context: ContextGraph, status: str) -> ContextGraph:
    release = context.release.model_copy(update={"data_status": status})
    return context.model_copy(update={"release": release})


def _is_fresh(published_at: datetime, now: datetime, ttl: timedelta) -> bool:
    if published_at.utcoffset() is None or now.utcoffset() is None:
        raise ValueError("live-context timestamps must include a UTC offset")
    return now - published_at < ttl


def _fixture_status(
    context: ContextGraph, error_code: str | None = None
) -> SiteDataStatus:
    return SiteDataStatus(
        parcel_id=context.site.parcel_id,
        status="fixture",
        graph_release_id=context.release.id,
        published_at=None,
        source_cutoff_at=context.release.source_cutoff_at,
        last_refresh_started_at=None,
        last_refresh_completed_at=None,
        last_error_code=error_code,
    )


def _refresh_error_code(error: Exception) -> str:
    if isinstance(error, TimeoutError):
        return "datasf_timeout"
    if isinstance(error, NotFoundError):
        return "parcel_not_found"
    if isinstance(error, DataSFCompileError):
        return "datasf_invalid"
    if isinstance(error, LeaseLostError):
        return "lease_lost"
    if isinstance(error, ContextCapacityError):
        return "capacity_reached"
    return "refresh_failed"


def _log_refresh_failure(parcel_id: str, code: str, error: Exception) -> None:
    logger.warning(
        json.dumps(
            {
                "error_code": code,
                "error_type": type(error).__name__,
                "event": "live_context_refresh_failed",
                "parcel_id": parcel_id,
            },
            separators=(",", ":"),
            sort_keys=True,
        )
    )
