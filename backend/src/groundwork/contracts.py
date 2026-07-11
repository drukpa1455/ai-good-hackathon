from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)


def _iso_date(value: str) -> str:
    date.fromisoformat(value)
    return value


def _iso_datetime(value: str) -> str:
    datetime.fromisoformat(value)
    return value


def _iso_temporal(value: str) -> str:
    try:
        return _iso_datetime(value)
    except ValueError:
        return _iso_date(value)


Identifier = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
Sha256 = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{64}$")]
IsoDate = Annotated[str, AfterValidator(_iso_date)]
IsoDateTime = Annotated[str, AfterValidator(_iso_datetime)]
IsoTemporal = Annotated[str, AfterValidator(_iso_temporal)]
ContextFocus = Literal["overview", "housing", "permits", "hazards", "neighborhood"]
DataStatus = Literal["fixture", "live", "stale"]
AssertionCategory = ContextFocus | Literal["identity"]
EntityKind = Literal[
    "parcel",
    "development_project",
    "permit",
    "assessment_series",
    "housing_program",
    "hazard_map",
    "neighborhood_signal",
    "source_record",
]
DiagnosticKind = Literal["freshness", "conflict", "coverage_gap", "proximity_only"]
Scalar = str | int | float | bool | None
Position = tuple[float, float]

FOCUS_VALUES: tuple[ContextFocus, ...] = (
    "overview",
    "housing",
    "permits",
    "hazards",
    "neighborhood",
)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Point(StrictModel):
    longitude: float = Field(ge=-180, le=180)
    latitude: float = Field(ge=-90, le=90)


class PointGeometry(StrictModel):
    type: Literal["Point"]
    coordinates: Position


class PolygonGeometry(StrictModel):
    type: Literal["Polygon"]
    coordinates: list[list[Position]]


class MultiPolygonGeometry(StrictModel):
    type: Literal["MultiPolygon"]
    coordinates: list[list[list[Position]]]


GeoJsonGeometry = Annotated[
    PointGeometry | PolygonGeometry | MultiPolygonGeometry,
    Field(discriminator="type"),
]


class ReleaseSummary(StrictModel):
    id: Identifier
    created_at: IsoDateTime
    source_cutoff_at: IsoDateTime
    compiler_version: Identifier
    mock: bool
    data_status: DataStatus = "fixture"

    @model_validator(mode="after")
    def validate_data_status(self) -> ReleaseSummary:
        if self.mock != (self.data_status == "fixture"):
            raise ValueError("fixture status and mock flag must agree")
        return self


class Headline(StrictModel):
    label: Identifier
    value: str


class SiteSummary(StrictModel):
    parcel_id: Identifier
    name: Identifier
    address: Identifier
    subtitle: str
    story: str
    centroid: Point
    geometry: GeoJsonGeometry
    headline: Headline


class Entity(StrictModel):
    id: Identifier
    kind: EntityKind
    label: Identifier
    description: str | None
    geometry: GeoJsonGeometry | None
    source_count: int = Field(ge=0)


class EntityObject(StrictModel):
    kind: Literal["entity"]
    entity_id: Identifier


class LiteralObject(StrictModel):
    kind: Literal["literal"]
    value: str | int | float | bool
    datatype: Literal["string", "integer", "decimal", "boolean", "date", "datetime"]
    unit: str | None


AssertionObject = Annotated[EntityObject | LiteralObject, Field(discriminator="kind")]


class Assertion(StrictModel):
    id: Identifier
    subject_id: Identifier
    predicate: Identifier
    predicate_label: Identifier
    category: AssertionCategory
    object: AssertionObject
    effective_at: IsoTemporal | None
    observed_at: IsoTemporal
    evidence_ids: list[Identifier] = Field(min_length=1)


class EvidenceRecord(StrictModel):
    id: Identifier
    dataset_id: Identifier
    dataset_name: Identifier
    title: Identifier
    record_key: Identifier
    source_url: str
    record_url: str | None
    license_id: Identifier
    retrieved_at: IsoDateTime
    source_updated_at: IsoDateTime | None
    artifact_sha256: Sha256
    scope_note: str | None
    parcel_ids: list[Identifier]
    assertion_ids: list[Identifier]
    fields: dict[str, Scalar]

    @model_validator(mode="after")
    def validate_urls(self) -> EvidenceRecord:
        for value in (self.source_url, self.record_url):
            if value is not None and not value.startswith("https://"):
                raise ValueError("evidence URLs must use https")
        return self


class Diagnostic(StrictModel):
    id: Identifier
    kind: DiagnosticKind
    severity: Literal["info", "warning"]
    title: Identifier
    detail: str
    assertion_ids: list[Identifier]
    evidence_ids: list[Identifier]


class AgentEvaluationSummary(StrictModel):
    status: Literal["passed", "failed", "not_run"]
    evaluated_at: IsoDateTime | None
    graph_release_id: Identifier | None
    agent_config_sha256: Identifier | None
    passed_cases: int = Field(ge=0)
    total_cases: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_counts(self) -> AgentEvaluationSummary:
        if self.passed_cases > self.total_cases:
            raise ValueError("passed cases cannot exceed total cases")
        if self.status == "not_run" and (self.passed_cases != 0 or self.total_cases != 0):
            raise ValueError("not_run evaluations must have zero cases")
        return self


class TrustSummary(StrictModel):
    graph_release_id: Identifier
    source_count: int = Field(ge=0)
    assertion_count: int = Field(ge=0)
    citation_coverage_percent: int = Field(ge=0, le=100)
    freshness_warning_count: int = Field(ge=0)
    conflict_count: int = Field(ge=0)
    coverage_gap_count: int = Field(ge=0)
    proximity_only_count: int = Field(ge=0)
    latest_agent_evaluation: AgentEvaluationSummary


class ContextGraph(StrictModel):
    schema_version: Literal["1.0"]
    release: ReleaseSummary
    site: SiteSummary
    focus: ContextFocus
    entities: list[Entity]
    assertions: list[Assertion]
    evidence: list[EvidenceRecord]
    diagnostics: list[Diagnostic]
    trust: TrustSummary


class AgentRuntimeConfig(StrictModel):
    enabled: bool
    script_url: str | None
    agent_id: str | None
    chatbot_id: str | None
    name: str
    starting_message: str
    primary_color: str
    secondary_color: str
    button_background_color: str


class PublicRuntimeConfig(StrictModel):
    data_mode: Literal["mock", "api"]
    agent: AgentRuntimeConfig


class ApiError(StrictModel):
    code: Literal["not_found", "invalid_focus", "context_too_large", "unavailable"]
    message: str
    request_id: str


class AgentContextRequest(StrictModel):
    site: str = Field(min_length=1, max_length=160)
    focus: str = Field(default="overview", min_length=1, max_length=32)
    question: str = Field(min_length=1, max_length=2_000)


class AgentContextPacket(StrictModel):
    context_packet: str
    graph_release_id: Identifier
    mock: bool
    data_status: DataStatus
    packet_sha256: Sha256


class SiteDataStatus(StrictModel):
    parcel_id: Identifier
    status: Literal["fixture", "live", "stale", "refreshing"]
    graph_release_id: Identifier
    published_at: IsoDateTime | None
    source_cutoff_at: IsoDateTime
    last_refresh_started_at: IsoDateTime | None
    last_refresh_completed_at: IsoDateTime | None
    last_error_code: Identifier | None


class DataStatusResponse(StrictModel):
    live_data_enabled: bool
    sites: list[SiteDataStatus]
