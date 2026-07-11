from __future__ import annotations

import hashlib
import json
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import parse_qs, urlparse

from pydantic import BaseModel, ConfigDict, TypeAdapter, ValidationError

from ..contracts import (
    AgentEvaluationSummary,
    Assertion,
    ContextGraph,
    Diagnostic,
    Entity,
    EntityObject,
    EvidenceRecord,
    GeoJsonGeometry,
    Headline,
    Point,
    PointGeometry,
    ReleaseSummary,
    SiteSummary,
    TrustSummary,
)
from .models import DataSFArtifact, DataSFParcelSeed, canonical_projection_bytes
from .registry import (
    DATASET_REGISTRY,
    DatasetSpec,
    dependent_queries,
    parcel_query,
    validate_parcel_id,
)


class DataSFCompileError(ValueError):
    """A bounded source projection cannot produce a trustworthy context graph."""


class _SourceRow(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class _ParcelRow(_SourceRow):
    blklot: str
    block_num: str
    lot_num: str
    from_address_num: str | None = None
    to_address_num: str | None = None
    street_name: str | None = None
    street_type: str | None = None
    active: bool
    in_asr_secured_roll: bool | None = None
    zoning_code: str | None = None
    zoning_district: str | None = None
    analysis_neighborhood: str | None = None
    centroid_latitude: str
    centroid_longitude: str
    shape: dict[str, Any] | None = None
    data_as_of: str | None = None
    data_loaded_at: str | None = None


class _PipelineRow(_SourceRow):
    blklot: str
    nameaddr: str | None = None
    current_status: str | None = None
    current_status_date: str | None = None
    proposed_units: str | None = None
    pipeline_affordable_units: str | None = None
    description_planning: str | None = None
    description_dbi: str | None = None
    bpa_no: str | None = None
    zoning_district: str | None = None
    nhood41: str | None = None
    latitude: str | None = None
    longitude: str | None = None


class _PermitRow(_SourceRow):
    permit_number: str
    permit_type_definition: str | None = None
    description: str | None = None
    status: str | None = None
    status_date: str | None = None
    filed_date: str | None = None
    issued_date: str | None = None
    completed_date: str | None = None
    proposed_units: str | None = None
    site_permit: str | None = None
    data_as_of: str | None = None
    data_loaded_at: str | None = None


class _AssessorRow(_SourceRow):
    closed_roll_year: str
    parcel_number: str
    block: str
    lot: str
    use_code: str | None = None
    assessed_land_value: str | None = None
    assessed_improvement_value: str | None = None
    property_class_code_definition: str | None = None
    number_of_units: str | None = None
    zoning_code: str | None = None
    data_as_of: str | None = None
    data_loaded_at: str | None = None


class _AhbpRow(_SourceRow):
    mapblklot: str
    zoning_sim: str | None = None
    heightlimi: str | None = None


class _FloodRow(_SourceRow):
    intersection_count: str
    data_as_of: str | None = None
    data_loaded_at: str | None = None


class _CasesRow(_SourceRow):
    case_count: str
    latest_updated_at: str | None = None
    data_as_of: str | None = None
    data_loaded_at: str | None = None


@dataclass(frozen=True)
class _EvidenceDraft:
    title: str
    record_key: str
    fields: dict[str, str | int | float | bool | None]
    scope_note: str | None = None


class DataSFCompiler:
    """Pure compiler from seven verified DataSF projections to one context graph."""

    compiler_version = "datasf-v1"

    def compile(
        self,
        artifacts: Sequence[DataSFArtifact],
        compiled_at: datetime,
        site: SiteSummary | None = None,
    ) -> ContextGraph:
        if compiled_at.utcoffset() is None:
            raise DataSFCompileError("compiled_at must include a UTC offset")
        indexed = self._index_artifacts(artifacts)

        parcel = _parcel_row(indexed["acdm-wktn"])
        seed = _seed(parcel)
        parcel_id = seed.parcel_id
        _validate_query_plan(indexed, seed, compiled_at)

        pipelines = self._parse_rows(indexed["6jgi-cpb4"], _PipelineRow)
        permits = self._parse_rows(indexed["i98e-djp9"], _PermitRow)
        assessments = self._parse_rows(indexed["wv5m-vpq2"], _AssessorRow)
        ahbp_rows = self._parse_rows(indexed["fizh-zaxt"], _AhbpRow)
        flood_rows = self._parse_rows(indexed["jzu3-4yxp"], _FloodRow)
        case_rows = self._parse_rows(indexed["vw6y-z8j6"], _CasesRow)
        self._validate_apn_rows(parcel_id, pipelines, assessments, ahbp_rows)

        pipeline = pipelines[0] if pipelines else None
        permit = _project_permit(pipeline, permits)
        permit_matches_pipeline = _permit_matches_pipeline(pipeline, permit)
        graph_site = _site_summary(parcel, seed.centroid, pipeline, site)
        evidence_ids = {
            dataset_id: f"ev-{dataset_id}-{parcel_id}" for dataset_id in DATASET_REGISTRY
        }
        entities = _entities(
            parcel_id,
            graph_site,
            pipeline,
            permit,
            permit_matches_pipeline,
            assessments,
            ahbp_rows,
        )
        assertions: list[Assertion] = []
        citations: dict[str, list[str]] = {dataset_id: [] for dataset_id in DATASET_REGISTRY}

        def add_assertion(assertion: Assertion, *dataset_ids: str) -> None:
            assertions.append(assertion)
            for dataset_id in dataset_ids:
                citations[dataset_id].append(assertion.id)

        parcel_entity = f"ent-{parcel_id}-parcel"
        add_assertion(
            _literal_assertion(
                id=f"asrt-{parcel_id}-parcel-id",
                subject_id=parcel_entity,
                predicate="parcel_id",
                label="parcel id",
                category="identity",
                value=parcel_id,
                datatype="string",
                effective_at=parcel.data_as_of,
                observed_at=_observed(indexed["acdm-wktn"], parcel.data_as_of),
                evidence_ids=[evidence_ids["acdm-wktn"]],
            ),
            "acdm-wktn",
        )
        if parcel.zoning_code:
            add_assertion(
                _literal_assertion(
                    id=f"asrt-{parcel_id}-parcel-zoning",
                    subject_id=parcel_entity,
                    predicate="zoning",
                    label="parcel zoning",
                    category="overview",
                    value=parcel.zoning_code,
                    datatype="string",
                    effective_at=parcel.data_as_of,
                    observed_at=_observed(indexed["acdm-wktn"], parcel.data_as_of),
                    evidence_ids=[evidence_ids["acdm-wktn"]],
                ),
                "acdm-wktn",
            )

        pipeline_status_id: str | None = None
        if pipeline is not None:
            project_entity = f"ent-{parcel_id}-project"
            add_assertion(
                Assertion(
                    id=f"asrt-{parcel_id}-located-on",
                    subject_id=project_entity,
                    predicate="located_on",
                    predicate_label="located on",
                    category="identity",
                    object=EntityObject(kind="entity", entity_id=parcel_entity),
                    effective_at=pipeline.current_status_date,
                    observed_at=_observed(indexed["6jgi-cpb4"], pipeline.current_status_date),
                    evidence_ids=[
                        evidence_ids["6jgi-cpb4"],
                        evidence_ids["acdm-wktn"],
                    ],
                ),
                "6jgi-cpb4",
                "acdm-wktn",
            )
            for predicate, label, value in (
                ("proposed_units", "proposed units", _integer(pipeline.proposed_units)),
                (
                    "affordable_units",
                    "affordable units",
                    _integer(pipeline.pipeline_affordable_units),
                ),
            ):
                if value is not None:
                    add_assertion(
                        _literal_assertion(
                            id=f"asrt-{parcel_id}-{predicate}",
                            subject_id=project_entity,
                            predicate=predicate,
                            label=label,
                            category="housing",
                            value=value,
                            datatype="integer",
                            unit="units",
                            effective_at=pipeline.current_status_date,
                            observed_at=_observed(
                                indexed["6jgi-cpb4"], pipeline.current_status_date
                            ),
                            evidence_ids=[evidence_ids["6jgi-cpb4"]],
                        ),
                        "6jgi-cpb4",
                    )
            if pipeline.current_status:
                pipeline_status_id = f"asrt-{parcel_id}-pipeline-status"
                add_assertion(
                    _literal_assertion(
                        id=pipeline_status_id,
                        subject_id=project_entity,
                        predicate="pipeline_status",
                        label="pipeline status",
                        category="housing",
                        value=pipeline.current_status,
                        datatype="string",
                        effective_at=pipeline.current_status_date,
                        observed_at=_observed(indexed["6jgi-cpb4"], pipeline.current_status_date),
                        evidence_ids=[evidence_ids["6jgi-cpb4"]],
                    ),
                    "6jgi-cpb4",
                )

        permit_status_id: str | None = None
        if permit is not None:
            permit_entity = f"ent-{parcel_id}-permit"
            target = (
                f"ent-{parcel_id}-project" if permit_matches_pipeline else parcel_entity
            )
            add_assertion(
                Assertion(
                    id=f"asrt-{parcel_id}-permit-for",
                    subject_id=permit_entity,
                    predicate="authorizes" if permit_matches_pipeline else "recorded_for",
                    predicate_label="authorizes" if permit_matches_pipeline else "recorded for",
                    category="permits",
                    object=EntityObject(kind="entity", entity_id=target),
                    effective_at=permit.filed_date or permit.status_date,
                    observed_at=_observed(indexed["i98e-djp9"], permit.status_date),
                    evidence_ids=[evidence_ids["i98e-djp9"]],
                ),
                "i98e-djp9",
            )
            if permit.status:
                permit_status_id = f"asrt-{parcel_id}-permit-status"
                add_assertion(
                    _literal_assertion(
                        id=permit_status_id,
                        subject_id=permit_entity,
                        predicate="permit_status",
                        label="permit status",
                        category="permits",
                        value=permit.status,
                        datatype="string",
                        effective_at=permit.status_date,
                        observed_at=_observed(indexed["i98e-djp9"], permit.status_date),
                        evidence_ids=[evidence_ids["i98e-djp9"]],
                    ),
                    "i98e-djp9",
                )

        if assessments:
            latest = assessments[0]
            assessor_entity = f"ent-{parcel_id}-assessor"
            add_assertion(
                Assertion(
                    id=f"asrt-{parcel_id}-assessor-describes",
                    subject_id=assessor_entity,
                    predicate="describes",
                    predicate_label="describes",
                    category="overview",
                    object=EntityObject(kind="entity", entity_id=parcel_entity),
                    effective_at=f"{latest.closed_roll_year}-07-01",
                    observed_at=_observed(indexed["wv5m-vpq2"], latest.data_as_of),
                    evidence_ids=[evidence_ids["wv5m-vpq2"]],
                ),
                "wv5m-vpq2",
            )
            for predicate, label, raw_value in (
                ("assessed_land_value", "assessed land value", latest.assessed_land_value),
                (
                    "assessed_improvement_value",
                    "assessed improvement value",
                    latest.assessed_improvement_value,
                ),
            ):
                value = _number(raw_value)
                if value is not None:
                    add_assertion(
                        _literal_assertion(
                            id=f"asrt-{parcel_id}-{predicate}",
                            subject_id=assessor_entity,
                            predicate=predicate,
                            label=f"{label} ({latest.closed_roll_year} roll)",
                            category="overview",
                            value=value,
                            datatype="decimal",
                            unit="USD",
                            effective_at=f"{latest.closed_roll_year}-07-01",
                            observed_at=_observed(indexed["wv5m-vpq2"], latest.data_as_of),
                            evidence_ids=[evidence_ids["wv5m-vpq2"]],
                        ),
                        "wv5m-vpq2",
                    )

        if ahbp_rows:
            add_assertion(
                Assertion(
                    id=f"asrt-{parcel_id}-ahbp-match",
                    subject_id=f"ent-{parcel_id}-ahbp",
                    predicate="matched",
                    predicate_label="matched (2015 layer)",
                    category="housing",
                    object=EntityObject(kind="entity", entity_id=parcel_entity),
                    effective_at="2015-10-02",
                    observed_at=_observed(indexed["fizh-zaxt"]),
                    evidence_ids=[evidence_ids["fizh-zaxt"]],
                ),
                "fizh-zaxt",
            )

        if flood_rows:
            flood = flood_rows[0]
            add_assertion(
                _literal_assertion(
                    id=f"asrt-{parcel_id}-flood-intersections",
                    subject_id=f"ent-{parcel_id}-flood",
                    predicate="centroid_intersection_count",
                    label="centroid flood-zone intersections",
                    category="hazards",
                    value=_required_integer(flood.intersection_count, "intersection_count"),
                    datatype="integer",
                    unit="zones",
                    effective_at="2022-07-19",
                    observed_at=_observed(indexed["jzu3-4yxp"], flood.data_as_of),
                    evidence_ids=[evidence_ids["jzu3-4yxp"]],
                ),
                "jzu3-4yxp",
            )

        if case_rows:
            cases = case_rows[0]
            add_assertion(
                _literal_assertion(
                    id=f"asrt-{parcel_id}-311-count",
                    subject_id=f"ent-{parcel_id}-311",
                    predicate="case_count_90d",
                    label="90-day case count within 150 m",
                    category="neighborhood",
                    value=_required_integer(cases.case_count, "case_count"),
                    datatype="integer",
                    unit="cases",
                    effective_at=None,
                    observed_at=_observed(
                        indexed["vw6y-z8j6"], cases.latest_updated_at or cases.data_as_of
                    ),
                    evidence_ids=[evidence_ids["vw6y-z8j6"]],
                ),
                "vw6y-z8j6",
            )

        drafts = _evidence_drafts(
            parcel_id,
            parcel,
            pipeline,
            permits,
            permit,
            permit_matches_pipeline,
            assessments,
            ahbp_rows,
            flood_rows,
            case_rows,
        )
        evidence = [
            _evidence_record(
                indexed[dataset_id],
                DATASET_REGISTRY[dataset_id],
                parcel_id,
                evidence_ids[dataset_id],
                citations[dataset_id],
                drafts[dataset_id],
            )
            for dataset_id in DATASET_REGISTRY
        ]
        diagnostics = _diagnostics(
            parcel_id=parcel_id,
            artifacts=indexed,
            pipeline=pipeline,
            permit=permit,
            permit_matches_pipeline=permit_matches_pipeline,
            pipeline_status_id=pipeline_status_id,
            permit_status_id=permit_status_id,
            evidence_ids=evidence_ids,
            citation_ids=citations,
        )

        source_cutoff = max(
            artifact.source_updated_at or artifact.retrieved_at for artifact in artifacts
        )
        release_id = _release_id(parcel_id, artifacts, compiled_at)
        trust = TrustSummary(
            graph_release_id=release_id,
            source_count=len(evidence),
            assertion_count=len(assertions),
            citation_coverage_percent=(
                round(sum(bool(item.evidence_ids) for item in assertions) * 100 / len(assertions))
                if assertions
                else 0
            ),
            freshness_warning_count=sum(item.kind == "freshness" for item in diagnostics),
            conflict_count=sum(item.kind == "conflict" for item in diagnostics),
            coverage_gap_count=sum(item.kind == "coverage_gap" for item in diagnostics),
            proximity_only_count=sum(item.kind == "proximity_only" for item in diagnostics),
            latest_agent_evaluation=AgentEvaluationSummary(
                status="not_run",
                evaluated_at=None,
                graph_release_id=None,
                agent_config_sha256=None,
                passed_cases=0,
                total_cases=0,
            ),
        )
        return ContextGraph(
            schema_version="1.0",
            release=ReleaseSummary(
                id=release_id,
                created_at=compiled_at.isoformat(),
                source_cutoff_at=source_cutoff.isoformat(),
                compiler_version=self.compiler_version,
                mock=False,
            ),
            site=graph_site,
            focus="overview",
            entities=entities,
            assertions=assertions,
            evidence=evidence,
            diagnostics=diagnostics,
            trust=trust,
        )

    def _index_artifacts(self, artifacts: Sequence[DataSFArtifact]) -> dict[str, DataSFArtifact]:
        indexed: dict[str, DataSFArtifact] = {}
        for artifact in artifacts:
            spec = DATASET_REGISTRY.get(artifact.dataset_id)
            if spec is None:
                raise DataSFCompileError(f"unknown DataSF dataset {artifact.dataset_id}")
            if artifact.dataset_id in indexed:
                raise DataSFCompileError(f"duplicate DataSF dataset {artifact.dataset_id}")
            _validate_projection(artifact, spec)
            indexed[artifact.dataset_id] = artifact
        missing = set(DATASET_REGISTRY) - set(indexed)
        if missing:
            raise DataSFCompileError(f"missing DataSF projections: {', '.join(sorted(missing))}")
        return indexed

    def _parse_rows(self, artifact: DataSFArtifact, model: type[_SourceRow]) -> list[Any]:
        try:
            return TypeAdapter(list[model]).validate_python(artifact.rows)  # type: ignore[valid-type]
        except ValidationError as error:
            raise DataSFCompileError(
                f"invalid {artifact.dataset_id} projection schema: {error.errors()[0]['msg']}"
            ) from error

    def _validate_apn_rows(
        self,
        parcel_id: str,
        pipelines: Sequence[_PipelineRow],
        assessments: Sequence[_AssessorRow],
        ahbp_rows: Sequence[_AhbpRow],
    ) -> None:
        if any(row.blklot != parcel_id for row in pipelines):
            raise DataSFCompileError("pipeline projection contains a different APN")
        if any(row.parcel_number != parcel_id for row in assessments):
            raise DataSFCompileError("assessor projection contains a different APN")
        if any(row.mapblklot != parcel_id for row in ahbp_rows):
            raise DataSFCompileError("AHBP projection contains a different APN")


def _validate_projection(artifact: DataSFArtifact, spec: DatasetSpec) -> None:
    actual_hash = hashlib.sha256(canonical_projection_bytes(artifact.rows)).hexdigest()
    if actual_hash != artifact.artifact_sha256:
        raise DataSFCompileError(f"{spec.id} artifact changed after its hash was computed")
    if len(artifact.rows) > spec.row_limit:
        raise DataSFCompileError(f"{spec.id} projection exceeds its {spec.row_limit}-row limit")
    query = parse_qs(urlparse(artifact.query_url).query, keep_blank_values=True)
    if query.get("$select") != [spec.select] or query.get("$limit") != [str(spec.row_limit)]:
        raise DataSFCompileError(f"{spec.id} query does not use its fixed bounded projection")
    for row in artifact.rows:
        unexpected = set(row) - spec.output_fields
        if unexpected:
            raise DataSFCompileError(
                f"{spec.id} returned fields outside its registry: {', '.join(sorted(unexpected))}"
            )


def parcel_seed(artifact: DataSFArtifact) -> DataSFParcelSeed:
    """Validate the first projection and expose only its APN and centroid."""
    spec = DATASET_REGISTRY["acdm-wktn"]
    if artifact.dataset_id != spec.id:
        raise DataSFCompileError("parcel seed requires the registered parcel projection")
    _validate_projection(artifact, spec)
    return _seed(_parcel_row(artifact))


def _parcel_row(artifact: DataSFArtifact) -> _ParcelRow:
    try:
        rows = TypeAdapter(list[_ParcelRow]).validate_python(artifact.rows)
    except ValidationError as error:
        raise DataSFCompileError(
            f"invalid {artifact.dataset_id} projection schema: {error.errors()[0]['msg']}"
        ) from error
    if len(rows) != 1:
        raise DataSFCompileError("active parcel projection must return exactly one row")
    return rows[0]


def _seed(parcel: _ParcelRow) -> DataSFParcelSeed:
    try:
        parcel_id = validate_parcel_id(parcel.blklot)
        if parcel.block_num + parcel.lot_num != parcel_id or not parcel.active:
            raise DataSFCompileError(
                "parcel projection does not describe the requested active APN"
            )
        centroid = Point(
            longitude=float(parcel.centroid_longitude),
            latitude=float(parcel.centroid_latitude),
        )
    except (TypeError, ValueError, ValidationError) as error:
        raise DataSFCompileError("parcel identity or centroid is invalid") from error
    return DataSFParcelSeed(parcel_id=parcel_id, centroid=centroid)


def _validate_query_plan(
    artifacts: dict[str, DataSFArtifact],
    seed: DataSFParcelSeed,
    compiled_at: datetime,
) -> None:
    expected_queries = (
        parcel_query(seed.parcel_id),
        *dependent_queries(seed.parcel_id, seed.centroid, compiled_at),
    )
    for expected in expected_queries:
        if artifacts[expected.dataset_id].query_url != expected.url:
            raise DataSFCompileError(
                f"{expected.dataset_id} query does not match the canonical parcel query plan"
            )


def _site_summary(
    parcel: _ParcelRow,
    centroid: Point,
    pipeline: _PipelineRow | None,
    existing: SiteSummary | None,
) -> SiteSummary:
    if existing is not None and existing.parcel_id != parcel.blklot:
        raise DataSFCompileError("provided site summary does not match parcel projection")

    geometry = _geometry(parcel, centroid)
    address_name = _address_name(parcel)
    neighborhood = (
        parcel.analysis_neighborhood
        or (pipeline.nhood41 if pipeline is not None else None)
        or "San Francisco"
    )
    status = pipeline.current_status if pipeline and pipeline.current_status else "Live context"
    affordable = _integer(pipeline.pipeline_affordable_units) if pipeline else None
    proposed = _integer(pipeline.proposed_units) if pipeline else None
    headline = (
        Headline(label="Affordable units", value=str(affordable))
        if affordable is not None
        else Headline(label="Data sources", value=str(len(DATASET_REGISTRY)))
    )
    story = (
        f"Live DataSF context for a {proposed}-unit project; source dates and gaps are "
        "preserved in its evidence graph."
        if proposed is not None
        else "Live DataSF parcel context with explicit source dates and coverage gaps."
    )
    if existing is not None:
        return existing.model_copy(
            update={
                "subtitle": f"{neighborhood} · {status}",
                "story": story,
                "centroid": centroid,
                "geometry": geometry,
                "headline": headline,
            }
        )
    return SiteSummary(
        parcel_id=parcel.blklot,
        name=address_name,
        address=f"{address_name}, San Francisco, CA",
        subtitle=f"{neighborhood} · {status}",
        story=story,
        centroid=centroid,
        geometry=geometry,
        headline=headline,
    )


def _geometry(parcel: _ParcelRow, centroid: Point) -> GeoJsonGeometry:
    if parcel.shape is None:
        return PointGeometry(type="Point", coordinates=(centroid.longitude, centroid.latitude))
    try:
        return TypeAdapter(GeoJsonGeometry).validate_python(parcel.shape)
    except ValidationError as error:
        raise DataSFCompileError("parcel geometry is invalid") from error


def _address_name(parcel: _ParcelRow) -> str:
    if not parcel.from_address_num or not parcel.street_name:
        return f"Parcel {parcel.blklot}"
    number = parcel.from_address_num
    if parcel.to_address_num and parcel.to_address_num != parcel.from_address_num:
        number = f"{number}–{parcel.to_address_num}"
    street = parcel.street_name.title()
    street_type = f" {parcel.street_type.title()}" if parcel.street_type else ""
    return f"{number} {street}{street_type}"


def _entities(
    parcel_id: str,
    site: SiteSummary,
    pipeline: _PipelineRow | None,
    permit: _PermitRow | None,
    permit_matches_pipeline: bool,
    assessments: Sequence[_AssessorRow],
    ahbp_rows: Sequence[_AhbpRow],
) -> list[Entity]:
    entities = [
        Entity(
            id=f"ent-{parcel_id}-parcel",
            kind="parcel",
            label=f"Parcel {parcel_id}",
            description=site.address,
            geometry=site.geometry,
            source_count=1,
        )
    ]
    if pipeline is not None:
        units = _integer(pipeline.proposed_units)
        entities.append(
            Entity(
                id=f"ent-{parcel_id}-project",
                kind="development_project",
                label=pipeline.nameaddr or f"Project on {parcel_id}",
                description=(
                    f"DataSF pipeline project with {units} proposed units."
                    if units is not None
                    else "DataSF development pipeline project."
                ),
                geometry=None,
                source_count=2 if permit_matches_pipeline else 1,
            )
        )
    if permit is not None:
        entities.append(
            Entity(
                id=f"ent-{parcel_id}-permit",
                kind="permit",
                label=f"Permit {permit.permit_number}",
                description=_clip(permit.description or permit.permit_type_definition, 320),
                geometry=None,
                source_count=1,
            )
        )
    if assessments:
        years = sorted(
            _required_integer(row.closed_roll_year, "closed_roll_year") for row in assessments
        )
        entities.append(
            Entity(
                id=f"ent-{parcel_id}-assessor",
                kind="assessment_series",
                label=f"Assessor rolls {years[0]}–{years[-1]}",
                description=f"{len(assessments)} bounded secured-roll records.",
                geometry=None,
                source_count=1,
            )
        )
    if ahbp_rows:
        entities.append(
            Entity(
                id=f"ent-{parcel_id}-ahbp",
                kind="housing_program",
                label="Historical AHBP match",
                description="Match in the 2015 Affordable Housing Bonus Program layer.",
                geometry=None,
                source_count=1,
            )
        )
    entities.extend(
        (
            Entity(
                id=f"ent-{parcel_id}-flood",
                kind="hazard_map",
                label="100-year storm flood risk zone (July 2022)",
                description="Centroid-only intersection against the historical flood layer.",
                geometry=None,
                source_count=1,
            ),
            Entity(
                id=f"ent-{parcel_id}-311",
                kind="neighborhood_signal",
                label="311 cases · 150 m",
                description="Server-side case-count aggregate for the previous 90 days.",
                geometry=None,
                source_count=1,
            ),
        )
    )
    return entities


def _literal_assertion(
    *,
    id: str,
    subject_id: str,
    predicate: str,
    label: str,
    category: str,
    value: str | int | float | bool,
    datatype: str,
    effective_at: str | None,
    observed_at: str,
    evidence_ids: list[str],
    unit: str | None = None,
) -> Assertion:
    return Assertion.model_validate(
        {
            "id": id,
            "subject_id": subject_id,
            "predicate": predicate,
            "predicate_label": label,
            "category": category,
            "object": {
                "kind": "literal",
                "value": value,
                "datatype": datatype,
                "unit": unit,
            },
            "effective_at": effective_at,
            "observed_at": observed_at,
            "evidence_ids": evidence_ids,
        }
    )


def _evidence_drafts(
    parcel_id: str,
    parcel: _ParcelRow,
    pipeline: _PipelineRow | None,
    permits: Sequence[_PermitRow],
    permit: _PermitRow | None,
    permit_matches_pipeline: bool,
    assessments: Sequence[_AssessorRow],
    ahbp_rows: Sequence[_AhbpRow],
    flood_rows: Sequence[_FloodRow],
    case_rows: Sequence[_CasesRow],
) -> dict[str, _EvidenceDraft]:
    pipeline_fields: dict[str, str | int | float | bool | None] = {"matched_row": False}
    if pipeline is not None:
        pipeline_fields = {
            "matched_row": True,
            "nameaddr": pipeline.nameaddr,
            "status": pipeline.current_status,
            "status_date": pipeline.current_status_date,
            "proposed_units": _integer(pipeline.proposed_units),
            "affordable_units": _integer(pipeline.pipeline_affordable_units),
            "bpa_no": pipeline.bpa_no,
            "zoning_district": pipeline.zoning_district,
            "description": _clip(pipeline.description_dbi or pipeline.description_planning, 500),
        }

    permit_fields: dict[str, str | int | float | bool | None] = {
        "matched_row": False,
        "queried_row_count": len(permits),
    }
    permit_scope = None
    if permit is not None:
        latest = permits[0]
        permit_fields = {
            "matched_row": True,
            "queried_row_count": len(permits),
            "permit_number": permit.permit_number,
            "permit_type": permit.permit_type_definition,
            "status": permit.status,
            "status_date": permit.status_date,
            "filed_date": permit.filed_date,
            "issued_date": permit.issued_date,
            "proposed_units": _number(permit.proposed_units),
            "description": _clip(permit.description, 500),
            "latest_activity_permit_number": latest.permit_number,
            "latest_activity_status_date": latest.status_date,
        }
        if latest.permit_number != permit.permit_number:
            permit_scope = (
                "The project permit matches the pipeline BPA number; the bounded parcel query "
                "also preserves the latest permit activity without treating it as the project."
            )
        elif pipeline is not None and not permit_matches_pipeline:
            permit_scope = (
                "No returned permit matched the pipeline BPA number. The latest bounded parcel "
                "permit is preserved without linking it to the pipeline project."
            )

    assessor_fields: dict[str, str | int | float | bool | None] = {
        "matched_row": False,
        "queried_row_count": 0,
    }
    assessor_key = f"{parcel_id}:none"
    if assessments:
        latest = assessments[0]
        years = sorted(
            _required_integer(row.closed_roll_year, "closed_roll_year") for row in assessments
        )
        assessor_key = f"{parcel_id}:{years[0]}-{years[-1]}"
        assessor_fields = {
            "matched_row": True,
            "queried_row_count": len(assessments),
            "closed_roll_years": f"{years[0]}–{years[-1]}",
            "latest_land_value_usd": _number(latest.assessed_land_value),
            "latest_improvement_value_usd": _number(latest.assessed_improvement_value),
            "use_code": latest.use_code,
            "property_class": latest.property_class_code_definition,
            "zoning_code": latest.zoning_code,
        }

    ahbp = ahbp_rows[0] if ahbp_rows else None
    flood = flood_rows[0] if flood_rows else None
    cases = case_rows[0] if case_rows else None
    return {
        "acdm-wktn": _EvidenceDraft(
            title=f"Active parcel record {parcel_id}",
            record_key=parcel_id,
            fields={
                "blklot": parcel.blklot,
                "block_num": parcel.block_num,
                "lot_num": parcel.lot_num,
                "active": parcel.active,
                "in_asr_secured_roll": parcel.in_asr_secured_roll,
                "zoning_code": parcel.zoning_code,
                "zoning_district": parcel.zoning_district,
                "analysis_neighborhood": parcel.analysis_neighborhood,
                "data_as_of": parcel.data_as_of,
            },
        ),
        "6jgi-cpb4": _EvidenceDraft(
            title=(
                f"Pipeline entry — {pipeline.nameaddr or parcel_id}"
                if pipeline is not None
                else "Development pipeline query returned no row"
            ),
            record_key=pipeline.bpa_no or parcel_id if pipeline is not None else parcel_id,
            fields=pipeline_fields,
        ),
        "i98e-djp9": _EvidenceDraft(
            title=(
                f"Building permit {permit.permit_number}"
                if permit is not None
                else "Building permit query returned no row"
            ),
            record_key=permit.permit_number if permit is not None else parcel_id,
            fields=permit_fields,
            scope_note=permit_scope,
        ),
        "wv5m-vpq2": _EvidenceDraft(
            title=(
                f"Secured roll series ({len(assessments)} rows)"
                if assessments
                else "Assessor roll query returned no row"
            ),
            record_key=assessor_key,
            fields=assessor_fields,
            scope_note="Series compiled from at most nine annual roll rows.",
        ),
        "fizh-zaxt": _EvidenceDraft(
            title="Historical AHBP eligible-parcels query",
            record_key=f"ahbp:{parcel_id}",
            fields={
                "matched_row": ahbp is not None,
                "layer_vintage": 2015,
                "zoning": ahbp.zoning_sim if ahbp else None,
                "height_limit": ahbp.heightlimi if ahbp else None,
            },
            scope_note=(
                "Historical 2015 layer; a match is not current eligibility, and no row is not "
                "evidence of ineligibility."
            ),
        ),
        "jzu3-4yxp": _EvidenceDraft(
            title="Flood risk zone centroid evaluation",
            record_key=f"flood:{parcel_id}:centroid",
            fields={
                "intersection_count": (
                    _required_integer(flood.intersection_count, "intersection_count")
                    if flood
                    else None
                ),
                "layer_effective": "2022-07-19",
                "evaluation": "parcel centroid only",
            },
            scope_note=(
                "Historical centroid-only screening; it is not a parcel-wide or current safety "
                "conclusion."
            ),
        ),
        "vw6y-z8j6": _EvidenceDraft(
            title="311 cases within 150 m (90 days)",
            record_key=f"311:{parcel_id}:150m:90d",
            fields={
                "case_count": (
                    _required_integer(cases.case_count, "case_count") if cases else None
                ),
                "latest_updated_at": cases.latest_updated_at if cases else None,
                "radius_m": 150,
                "window_days": 90,
                "server_side_aggregate": True,
            },
            scope_note="Proximity aggregate; no individual case notes or media were retrieved.",
        ),
    }


def _evidence_record(
    artifact: DataSFArtifact,
    spec: DatasetSpec,
    parcel_id: str,
    evidence_id: str,
    assertion_ids: list[str],
    draft: _EvidenceDraft,
) -> EvidenceRecord:
    return EvidenceRecord(
        id=evidence_id,
        dataset_id=spec.id,
        dataset_name=spec.name,
        title=draft.title,
        record_key=draft.record_key,
        source_url=spec.source_url,
        record_url=artifact.query_url,
        license_id=spec.license_id,
        retrieved_at=artifact.retrieved_at.isoformat(),
        source_updated_at=(
            artifact.source_updated_at.isoformat() if artifact.source_updated_at else None
        ),
        artifact_sha256=artifact.artifact_sha256,
        scope_note=draft.scope_note,
        parcel_ids=[parcel_id],
        assertion_ids=assertion_ids,
        fields=draft.fields,
    )


def _diagnostics(
    *,
    parcel_id: str,
    artifacts: dict[str, DataSFArtifact],
    pipeline: _PipelineRow | None,
    permit: _PermitRow | None,
    permit_matches_pipeline: bool,
    pipeline_status_id: str | None,
    permit_status_id: str | None,
    evidence_ids: dict[str, str],
    citation_ids: dict[str, list[str]],
) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    for dataset_id, artifact in artifacts.items():
        if dataset_id == "acdm-wktn" or artifact.rows:
            continue
        spec = DATASET_REGISTRY[dataset_id]
        diagnostics.append(
            Diagnostic(
                id=f"diag-{parcel_id}-{dataset_id}-gap",
                kind="coverage_gap",
                severity="warning",
                title=f"{spec.name} query returned no row",
                detail=(
                    "The bounded live query returned no row. This is recorded as missing "
                    "coverage, not as evidence that the underlying condition is false."
                ),
                assertion_ids=citation_ids[dataset_id],
                evidence_ids=[evidence_ids[dataset_id]],
            )
        )
    if (
        pipeline
        and permit
        and permit_matches_pipeline
        and pipeline.current_status_date
        and permit.status_date
    ):
        if _comparable_datetime(permit.status_date) > _comparable_datetime(
            pipeline.current_status_date
        ):
            diagnostics.append(
                Diagnostic(
                    id=f"diag-{parcel_id}-pipeline-permit-freshness",
                    kind="freshness",
                    severity="warning",
                    title="Permit activity is newer than the pipeline status",
                    detail=(
                        f"The pipeline reports {pipeline.current_status or 'an unknown status'} "
                        f"at {pipeline.current_status_date}; its matching permit reports "
                        f"{permit.status or 'an unknown status'} at {permit.status_date}. Both "
                        "dated claims are preserved rather than silently choosing one."
                    ),
                    assertion_ids=[
                        assertion_id
                        for assertion_id in (pipeline_status_id, permit_status_id)
                        if assertion_id is not None
                    ],
                    evidence_ids=[evidence_ids["6jgi-cpb4"], evidence_ids["i98e-djp9"]],
                )
            )
    if pipeline is not None and permit is not None and not permit_matches_pipeline:
        missing_bpa_detail = (
            f"The pipeline BPA number {pipeline.bpa_no} was not present in the five returned "
            "permit rows."
            if pipeline.bpa_no
            else "The pipeline row has no BPA number that can establish project identity."
        )
        diagnostics.append(
            Diagnostic(
                id=f"diag-{parcel_id}-pipeline-permit-identity-gap",
                kind="coverage_gap",
                severity="warning",
                title="Pipeline project permit was not found in the bounded permit rows",
                detail=(
                    f"{missing_bpa_detail} The latest parcel permit {permit.permit_number} is "
                    "preserved only as parcel evidence and is not linked to the project."
                ),
                assertion_ids=[
                    assertion_id
                    for assertion_id in (pipeline_status_id, permit_status_id)
                    if assertion_id is not None
                ],
                evidence_ids=[evidence_ids["6jgi-cpb4"], evidence_ids["i98e-djp9"]],
            )
        )
    if artifacts["fizh-zaxt"].rows:
        diagnostics.append(
            Diagnostic(
                id=f"diag-{parcel_id}-ahbp-historical",
                kind="freshness",
                severity="warning",
                title="AHBP match comes from a 2015 layer",
                detail=(
                    "The historical layer match is preserved for context and must not be read "
                    "as current program eligibility."
                ),
                assertion_ids=citation_ids["fizh-zaxt"],
                evidence_ids=[evidence_ids["fizh-zaxt"]],
            )
        )
    diagnostics.extend(
        (
            Diagnostic(
                id=f"diag-{parcel_id}-flood-historical",
                kind="freshness",
                severity="warning",
                title="Flood layer is historical and centroid-only",
                detail=(
                    "The July 2022 layer was queried at the parcel centroid. Treat it as a "
                    "historical screening signal, not a current parcel-wide conclusion."
                ),
                assertion_ids=citation_ids["jzu3-4yxp"],
                evidence_ids=[evidence_ids["jzu3-4yxp"]],
            ),
            Diagnostic(
                id=f"diag-{parcel_id}-311-proximity",
                kind="proximity_only",
                severity="info",
                title="311 signal is proximity-based",
                detail=(
                    "The server-side count covers a 150 m radius for 90 days and describes the "
                    "surrounding area, not the parcel itself."
                ),
                assertion_ids=citation_ids["vw6y-z8j6"],
                evidence_ids=[evidence_ids["vw6y-z8j6"]],
            ),
        )
    )
    return diagnostics


def _project_permit(
    pipeline: _PipelineRow | None, permits: Sequence[_PermitRow]
) -> _PermitRow | None:
    if not permits:
        return None
    if pipeline is not None and pipeline.bpa_no:
        match = next(
            (permit for permit in permits if permit.permit_number == pipeline.bpa_no), None
        )
        if match is not None:
            return match
    return permits[0]


def _permit_matches_pipeline(
    pipeline: _PipelineRow | None, permit: _PermitRow | None
) -> bool:
    return bool(
        pipeline is not None
        and pipeline.bpa_no
        and permit is not None
        and permit.permit_number == pipeline.bpa_no
    )


def _release_id(parcel_id: str, artifacts: Sequence[DataSFArtifact], compiled_at: datetime) -> str:
    material = {
        "artifacts": {
            artifact.dataset_id: artifact.artifact_sha256
            for artifact in sorted(artifacts, key=lambda item: item.dataset_id)
        },
        "compiled_at": compiled_at.isoformat(),
        "parcel_id": parcel_id,
    }
    encoded = json.dumps(material, separators=(",", ":"), sort_keys=True).encode()
    return f"live-{hashlib.sha256(encoded).hexdigest()[:20]}"


def _observed(artifact: DataSFArtifact, source_value: str | None = None) -> str:
    if source_value:
        return source_value
    return (artifact.source_updated_at or artifact.retrieved_at).isoformat()


def _integer(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        number = float(value)
    except ValueError as error:
        raise DataSFCompileError(f"expected numeric DataSF value, received {value!r}") from error
    if not number.is_integer():
        raise DataSFCompileError(f"expected integer DataSF value, received {value!r}")
    return int(number)


def _required_integer(value: str, field: str) -> int:
    parsed = _integer(value)
    if parsed is None:  # pragma: no cover - type excludes None
        raise DataSFCompileError(f"{field} is required")
    return parsed


def _number(value: str | None) -> int | float | None:
    if value is None:
        return None
    try:
        number = float(value)
    except ValueError as error:
        raise DataSFCompileError(f"expected numeric DataSF value, received {value!r}") from error
    return int(number) if number.is_integer() else number


def _clip(value: str | None, limit: int) -> str | None:
    if value is None:
        return None
    normalized = " ".join(value.split())
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 1].rstrip() + "…"


def _comparable_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)
