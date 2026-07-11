from __future__ import annotations

import hashlib
from pathlib import Path, PurePosixPath
from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from .contracts import (
    FOCUS_VALUES,
    ContextGraph,
    EntityObject,
    EvidenceRecord,
    SiteSummary,
)


class ReleaseError(ValueError):
    """The immutable release cannot be trusted."""


class NotFoundError(LookupError):
    """The requested graph object does not exist."""


class InvalidFocusError(ValueError):
    """The requested focus is outside the public contract."""


class ReleaseManifest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    schema_version: str
    release_id: str
    mock: bool
    created_at: str
    source_cutoff_at: str
    sites_file: str
    contexts: dict[str, str] = Field(min_length=1)
    files: dict[str, str] = Field(min_length=1)


class ContextRepository(Protocol):
    @property
    def release_id(self) -> str: ...

    @property
    def mock(self) -> bool: ...

    def list_sites(self) -> list[SiteSummary]: ...

    def get_context(self, parcel_id: str, focus: str) -> ContextGraph: ...

    def get_evidence(self, evidence_id: str) -> EvidenceRecord: ...


class JsonReleaseRepository:
    def __init__(
        self,
        manifest: ReleaseManifest,
        sites: list[SiteSummary],
        contexts: dict[str, ContextGraph],
        evidence: dict[str, EvidenceRecord],
    ) -> None:
        self._manifest = manifest
        self._sites = tuple(sites)
        self._contexts = contexts
        self._evidence = evidence

    @classmethod
    def load(cls, release_dir: Path) -> JsonReleaseRepository:
        root = release_dir.resolve(strict=True)
        manifest = ReleaseManifest.model_validate_json((root / "manifest.json").read_text())
        if manifest.schema_version != "1.0":
            raise ReleaseError(f"unsupported release schema: {manifest.schema_version}")
        expected_files = {manifest.sites_file, *manifest.contexts.values()}
        if set(manifest.files) != expected_files:
            raise ReleaseError("manifest files must exactly match release inputs")

        for relative, expected_hash in manifest.files.items():
            path = _release_path(root, relative)
            actual_hash = hashlib.sha256(path.read_bytes()).hexdigest()
            if actual_hash != expected_hash:
                raise ReleaseError(f"release hash mismatch: {relative}")

        sites = TypeAdapter(list[SiteSummary]).validate_json(
            _release_path(root, manifest.sites_file).read_text()
        )
        site_by_id = _unique_index(sites, "site", lambda site: site.parcel_id)
        if set(site_by_id) != set(manifest.contexts):
            raise ReleaseError("manifest contexts must exactly match site parcel ids")

        contexts: dict[str, ContextGraph] = {}
        evidence: dict[str, EvidenceRecord] = {}
        for parcel_id, relative in sorted(manifest.contexts.items()):
            context = ContextGraph.model_validate_json(_release_path(root, relative).read_text())
            _validate_context(manifest, site_by_id[parcel_id], parcel_id, context)
            contexts[parcel_id] = context
            for record in context.evidence:
                if record.id in evidence:
                    raise ReleaseError(f"duplicate evidence id across contexts: {record.id}")
                evidence[record.id] = record

        return cls(manifest, sites, contexts, evidence)

    @property
    def release_id(self) -> str:
        return self._manifest.release_id

    @property
    def mock(self) -> bool:
        return self._manifest.mock

    def list_sites(self) -> list[SiteSummary]:
        return list(self._sites)

    def get_context(self, parcel_id: str, focus: str) -> ContextGraph:
        if focus not in FOCUS_VALUES:
            raise InvalidFocusError(f"Unknown focus {focus}")
        context = self._contexts.get(parcel_id)
        if context is None:
            raise NotFoundError(f"No site with parcel id {parcel_id}")
        return filter_by_focus(context, focus)

    def get_evidence(self, evidence_id: str) -> EvidenceRecord:
        record = self._evidence.get(evidence_id)
        if record is None:
            raise NotFoundError(f"No evidence record {evidence_id}")
        return record


def _release_path(root: Path, relative: str) -> Path:
    parsed = PurePosixPath(relative)
    if parsed.is_absolute() or ".." in parsed.parts:
        raise ReleaseError(f"unsafe release path: {relative}")
    path = (root / parsed).resolve(strict=True)
    if not path.is_relative_to(root):
        raise ReleaseError(f"release path escapes root: {relative}")
    return path


def _unique_index(items: list, kind: str, key) -> dict:
    result = {}
    for item in items:
        item_id = key(item)
        if item_id in result:
            raise ReleaseError(f"duplicate {kind} id: {item_id}")
        result[item_id] = item
    return result


def _validate_context(
    manifest: ReleaseManifest,
    site: SiteSummary,
    parcel_id: str,
    context: ContextGraph,
) -> None:
    if context.site != site or context.site.parcel_id != parcel_id:
        raise ReleaseError(f"context site mismatch: {parcel_id}")
    if context.focus != "overview":
        raise ReleaseError(f"base context must use overview focus: {parcel_id}")
    if (
        context.release.id != manifest.release_id
        or context.release.mock != manifest.mock
        or context.release.created_at != manifest.created_at
        or context.release.source_cutoff_at != manifest.source_cutoff_at
    ):
        raise ReleaseError(f"context release mismatch: {parcel_id}")
    if context.trust.graph_release_id != manifest.release_id:
        raise ReleaseError(f"trust release mismatch: {parcel_id}")

    entities = _unique_index(context.entities, "entity", lambda item: item.id)
    assertions = _unique_index(context.assertions, "assertion", lambda item: item.id)
    evidence = _unique_index(context.evidence, "evidence", lambda item: item.id)
    _unique_index(context.diagnostics, "diagnostic", lambda item: item.id)

    for assertion in context.assertions:
        if assertion.subject_id not in entities:
            raise ReleaseError(f"unknown assertion subject: {assertion.id}")
        if (
            isinstance(assertion.object, EntityObject)
            and assertion.object.entity_id not in entities
        ):
            raise ReleaseError(f"unknown assertion object: {assertion.id}")
        for evidence_id in assertion.evidence_ids:
            record = evidence.get(evidence_id)
            if record is None:
                raise ReleaseError(f"unknown assertion evidence: {assertion.id}/{evidence_id}")
            if assertion.id not in record.assertion_ids:
                raise ReleaseError(f"invalid evidence back-reference: {evidence_id}/{assertion.id}")

    for record in context.evidence:
        if parcel_id not in record.parcel_ids:
            raise ReleaseError(f"evidence does not name its context parcel: {record.id}")
        for assertion_id in record.assertion_ids:
            assertion = assertions.get(assertion_id)
            if assertion is None or record.id not in assertion.evidence_ids:
                raise ReleaseError(f"invalid evidence back-reference: {record.id}/{assertion_id}")

    for diagnostic in context.diagnostics:
        if any(assertion_id not in assertions for assertion_id in diagnostic.assertion_ids):
            raise ReleaseError(f"unknown diagnostic assertion: {diagnostic.id}")
        if any(evidence_id not in evidence for evidence_id in diagnostic.evidence_ids):
            raise ReleaseError(f"unknown diagnostic evidence: {diagnostic.id}")

    cited = sum(bool(assertion.evidence_ids) for assertion in context.assertions)
    coverage = round(cited * 100 / len(context.assertions)) if context.assertions else 0
    expected_metrics = {
        "source_count": len(context.evidence),
        "assertion_count": len(context.assertions),
        "citation_coverage_percent": coverage,
        "freshness_warning_count": sum(d.kind == "freshness" for d in context.diagnostics),
        "conflict_count": sum(d.kind == "conflict" for d in context.diagnostics),
        "coverage_gap_count": sum(d.kind == "coverage_gap" for d in context.diagnostics),
        "proximity_only_count": sum(d.kind == "proximity_only" for d in context.diagnostics),
    }
    for field, expected in expected_metrics.items():
        if getattr(context.trust, field) != expected:
            raise ReleaseError(f"trust metric mismatch: {parcel_id}/{field}")


def filter_by_focus(context: ContextGraph, focus: str) -> ContextGraph:
    if focus not in FOCUS_VALUES:
        raise InvalidFocusError(f"Unknown focus {focus}")
    if focus == "overview":
        return context
    assertions = [
        assertion
        for assertion in context.assertions
        if assertion.category == focus or assertion.category == "identity"
    ]
    entity_ids = {
        entity_id
        for assertion in assertions
        for entity_id in (
            assertion.subject_id,
            assertion.object.entity_id if isinstance(assertion.object, EntityObject) else None,
        )
        if entity_id is not None
    }
    entities = [
        entity for entity in context.entities if entity.kind == "parcel" or entity.id in entity_ids
    ]
    return context.model_copy(
        update={"focus": focus, "assertions": assertions, "entities": entities}
    )
