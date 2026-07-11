from __future__ import annotations

import hashlib
from datetime import UTC, date, datetime
from urllib.parse import parse_qs, urlparse

import pytest
from pydantic import ValidationError

from groundwork.agent_context import FullGraphContextProvider
from groundwork.contracts import (
    ContextGraph,
    EvidenceRecord,
    Point,
    PointGeometry,
    SiteSummary,
)
from groundwork.datasf import (
    DATASET_REGISTRY,
    DataSFArtifact,
    DataSFCompileError,
    DataSFCompiler,
    canonical_projection_bytes,
    dependent_queries,
    parcel_query,
    parcel_seed,
)
from groundwork.repository import InvalidFocusError, NotFoundError

PARCEL_ID = "0161014"
COMPILED_AT = datetime(2026, 7, 11, 9, 0, tzinfo=UTC)
RETRIEVED_AT = datetime(2026, 7, 11, 8, 58, tzinfo=UTC)
SOURCE_UPDATED_AT = datetime(2026, 7, 10, 22, 0, tzinfo=UTC)


def _rows() -> dict[str, list[dict]]:
    return {
        "acdm-wktn": [
            {
                "blklot": PARCEL_ID,
                "block_num": "0161",
                "lot_num": "014",
                "from_address_num": "758",
                "to_address_num": "772",
                "street_name": "PACIFIC",
                "street_type": "AVE",
                "active": True,
                "in_asr_secured_roll": True,
                "zoning_code": "CRNC",
                "zoning_district": "CHINATOWN RESIDENTIAL NEIGHBORHOOD COMMERCIAL",
                "analysis_neighborhood": "Chinatown",
                "centroid_latitude": "37.796978",
                "centroid_longitude": "-122.407850",
                "shape": {
                    "type": "MultiPolygon",
                    "coordinates": [
                        [
                            [
                                [-122.4080, 37.7968],
                                [-122.4077, 37.7968],
                                [-122.4077, 37.7971],
                                [-122.4080, 37.7971],
                                [-122.4080, 37.7968],
                            ]
                        ]
                    ],
                },
                "data_as_of": "2026-07-10T01:00:00.000",
                "data_loaded_at": "2026-07-10T05:00:00.000",
            }
        ],
        "6jgi-cpb4": [
            {
                "blklot": PARCEL_ID,
                "nameaddr": "758 & 772 PACIFIC AVENUE",
                "current_status": "BP Filed",
                "current_status_date": "2025-12-26T00:00:00.000",
                "proposed_units": "175",
                "pipeline_affordable_units": "174",
                "description_planning": "A 100% affordable senior housing project.",
                "description_dbi": "Construction of 15-story, 175-unit senior housing.",
                "bpa_no": "202512151804",
                "zoning_district": "CRNC",
                "nhood41": "Chinatown",
                "latitude": "37.796982",
                "longitude": "-122.407863",
            }
        ],
        "i98e-djp9": [
            {
                "permit_number": "202512151804",
                "permit_type_definition": "new construction",
                "description": "Construction of 175 affordable senior housing units.",
                "status": "issued",
                "status_date": "2026-06-17T09:25:41.000",
                "filed_date": "2025-12-26T16:19:37.000",
                "issued_date": "2026-06-17T09:25:41.000",
                "proposed_units": "175.0",
                "site_permit": "Y",
                "data_as_of": "2026-06-19T01:05:02.000",
                "data_loaded_at": "2026-06-19T05:41:34.208",
            }
        ],
        "wv5m-vpq2": [
            {
                "closed_roll_year": "2025",
                "parcel_number": PARCEL_ID,
                "block": "0161",
                "lot": "014",
                "use_code": "MIX",
                "assessed_land_value": "6200000.0",
                "assessed_improvement_value": "830000.0",
                "property_class_code_definition": "Mixed Use",
                "number_of_units": "2.0",
                "zoning_code": "CRNC",
                "data_as_of": "2026-06-26T12:56:13.000",
                "data_loaded_at": "2026-06-26T15:13:35.000",
            },
            {
                "closed_roll_year": "2024",
                "parcel_number": PARCEL_ID,
                "block": "0161",
                "lot": "014",
                "use_code": "MIX",
                "assessed_land_value": "6000000.0",
                "assessed_improvement_value": "800000.0",
                "property_class_code_definition": "Mixed Use",
                "number_of_units": "2.0",
                "zoning_code": "CRNC",
                "data_as_of": "2025-06-09T00:00:00.000",
                "data_loaded_at": "2026-06-26T15:13:35.000",
            },
        ],
        "fizh-zaxt": [],
        "jzu3-4yxp": [{"intersection_count": "0"}],
        "vw6y-z8j6": [
            {
                "case_count": "118",
                "latest_updated_at": "2026-07-10T20:35:04.000",
                "data_as_of": "2026-07-11T01:00:00.000",
                "data_loaded_at": "2026-07-11T03:13:19.000",
            }
        ],
    }


def _queries():
    centroid = Point(longitude=-122.40785, latitude=37.796978)
    return (parcel_query(PARCEL_ID), *dependent_queries(PARCEL_ID, centroid, date(2026, 7, 11)))


def _artifacts(rows: dict[str, list[dict]] | None = None) -> tuple[DataSFArtifact, ...]:
    projections = rows or _rows()
    return tuple(
        DataSFArtifact.from_rows(
            dataset_id=query.dataset_id,
            query_url=query.url,
            retrieved_at=RETRIEVED_AT,
            source_updated_at=SOURCE_UPDATED_AT,
            rows=projections[query.dataset_id],
        )
        for query in _queries()
    )


def test_registry_builds_one_parcel_query_then_six_bounded_queries() -> None:
    queries = _queries()
    assert list(DATASET_REGISTRY) == [
        "acdm-wktn",
        "6jgi-cpb4",
        "i98e-djp9",
        "wv5m-vpq2",
        "fizh-zaxt",
        "jzu3-4yxp",
        "vw6y-z8j6",
    ]
    assert [query.dataset_id for query in queries] == list(DATASET_REGISTRY)

    for query in queries:
        parameters = parse_qs(urlparse(query.url).query)
        assert parameters["$select"] == [query.dataset.select]
        assert parameters["$limit"] == [str(query.dataset.row_limit)]
        assert query.dataset.row_limit <= 9

    cases_query = queries[-1]
    parameters = parse_qs(urlparse(cases_query.url).query)
    assert "count(*) as case_count" in parameters["$select"][0]
    assert "within_circle" in parameters["$where"][0]
    assert "2026-04-12T00:00:00.000" in parameters["$where"][0]
    assert "status_notes" not in cases_query.url
    assert "media_url" not in cases_query.url


def test_parcel_seed_drives_the_second_query_phase() -> None:
    first = _artifacts()[0]
    seed = parcel_seed(first)
    assert seed.parcel_id == PARCEL_ID
    assert seed.centroid == Point(longitude=-122.40785, latitude=37.796978)
    assert len(dependent_queries(seed.parcel_id, seed.centroid, COMPILED_AT)) == 6


@pytest.mark.parametrize("parcel_id", ["", "0161-014", "016101", "01610140", "abcdefg"])
def test_registry_rejects_any_non_seven_digit_apn(parcel_id: str) -> None:
    with pytest.raises(ValueError, match="seven digits"):
        parcel_query(parcel_id)


def test_artifact_identity_is_canonical_and_validated() -> None:
    query = parcel_query(PARCEL_ID)
    rows = _rows()["acdm-wktn"]
    artifact = DataSFArtifact.from_rows(
        dataset_id=query.dataset_id,
        query_url=query.url,
        retrieved_at=RETRIEVED_AT,
        source_updated_at=SOURCE_UPDATED_AT,
        rows=rows,
    )
    assert artifact.artifact_sha256 == hashlib.sha256(
        canonical_projection_bytes(rows)
    ).hexdigest()

    invalid = artifact.model_dump(mode="python")
    invalid["artifact_sha256"] = "0" * 64
    with pytest.raises(ValidationError, match="hash does not match"):
        DataSFArtifact.model_validate(invalid)

    artifact.rows[0]["street_name"] = "MUTATED"
    with pytest.raises(DataSFCompileError, match="changed after its hash"):
        parcel_seed(artifact)

    with pytest.raises(ValueError, match="only JSON values"):
        DataSFArtifact.from_rows(
            dataset_id=query.dataset_id,
            query_url=query.url,
            retrieved_at=RETRIEVED_AT,
            source_updated_at=SOURCE_UPDATED_AT,
            rows=[{"centroid_latitude": float("nan")}],
        )


def test_compiler_builds_live_graph_with_provenance_gaps_and_freshness() -> None:
    artifacts = _artifacts()
    graph = DataSFCompiler().compile(artifacts, COMPILED_AT)

    assert graph.release.mock is False
    assert graph.release.compiler_version == "datasf-v1"
    assert graph.site.parcel_id == PARCEL_ID
    assert graph.site.name == "758–772 Pacific Ave"
    assert graph.trust.source_count == 7
    assert graph.trust.citation_coverage_percent == 100
    assert {record.dataset_id for record in graph.evidence} == set(DATASET_REGISTRY)
    artifact_by_id = {artifact.dataset_id: artifact for artifact in artifacts}
    for record in graph.evidence:
        artifact = artifact_by_id[record.dataset_id]
        assert record.record_url == artifact.query_url
        assert record.retrieved_at == RETRIEVED_AT.isoformat()
        assert record.source_updated_at == SOURCE_UPDATED_AT.isoformat()
        assert record.artifact_sha256 == artifact.artifact_sha256
        assert record.license_id in {"PDDL-1.0", "CC0-1.0"}

    statuses = {
        assertion.predicate: assertion.object.value
        for assertion in graph.assertions
        if assertion.predicate in {"pipeline_status", "permit_status"}
    }
    assert statuses == {"pipeline_status": "BP Filed", "permit_status": "issued"}
    freshness = next(
        diagnostic
        for diagnostic in graph.diagnostics
        if diagnostic.id.endswith("pipeline-permit-freshness")
    )
    assert "2025-12-26" in freshness.detail
    assert "2026-06-17" in freshness.detail

    ahbp_gap = next(
        diagnostic
        for diagnostic in graph.diagnostics
        if diagnostic.id == f"diag-{PARCEL_ID}-fizh-zaxt-gap"
    )
    assert ahbp_gap.kind == "coverage_gap"
    ahbp_evidence = next(
        record for record in graph.evidence if record.dataset_id == "fizh-zaxt"
    )
    assert ahbp_evidence.fields["matched_row"] is False
    assert not any(
        diagnostic.kind == "coverage_gap" and "flood" in diagnostic.id
        for diagnostic in graph.diagnostics
    )


def test_compiled_live_packet_remains_under_function_boundary() -> None:
    graph = DataSFCompiler().compile(_artifacts(), COMPILED_AT)
    repository = _SingleContextRepository(graph)
    packet = FullGraphContextProvider(repository).retrieve(
        PARCEL_ID,
        "overview",
        "What changed between the pipeline and the building permit?",
    )
    assert packet.mock is False
    assert "LIVE DATASF PROJECTIONS" in packet.context_packet
    assert "DETERMINISTIC DEMO FIXTURE" not in packet.context_packet
    assert "DataSF projection SHA256:" in packet.context_packet
    assert len(packet.context_packet.encode()) <= 65_536
    assert packet.packet_sha256 == hashlib.sha256(packet.context_packet.encode()).hexdigest()


def test_unmatched_parcel_permit_is_never_linked_to_pipeline_project() -> None:
    rows = _rows()
    rows["6jgi-cpb4"][0]["bpa_no"] = "199901010001"
    graph = DataSFCompiler().compile(_artifacts(rows), COMPILED_AT)

    relation = next(
        assertion for assertion in graph.assertions if assertion.id.endswith("permit-for")
    )
    assert relation.predicate == "recorded_for"
    assert relation.object.entity_id == f"ent-{PARCEL_ID}-parcel"
    assert not any(assertion.predicate == "authorizes" for assertion in graph.assertions)
    assert any(
        diagnostic.id.endswith("pipeline-permit-identity-gap")
        and diagnostic.kind == "coverage_gap"
        for diagnostic in graph.diagnostics
    )
    assert not any(
        diagnostic.id.endswith("pipeline-permit-freshness")
        for diagnostic in graph.diagnostics
    )


def test_live_parcel_geometry_replaces_any_curated_fixture_geometry() -> None:
    compiler = DataSFCompiler()
    derived = compiler.compile(_artifacts(), COMPILED_AT)
    curated = derived.site.model_copy(
        update={
            "geometry": PointGeometry(type="Point", coordinates=(-122.0, 37.0)),
            "centroid": Point(longitude=-122.0, latitude=37.0),
        }
    )

    graph = compiler.compile(_artifacts(), COMPILED_AT, site=curated)
    assert graph.site.geometry == derived.site.geometry
    assert graph.site.centroid == derived.site.centroid


def test_compiler_rejects_unregistered_fields_and_unbounded_rows() -> None:
    rows = _rows()
    rows["6jgi-cpb4"][0]["contactph"] = "not permitted"
    with pytest.raises(DataSFCompileError, match="outside its registry"):
        DataSFCompiler().compile(_artifacts(rows), COMPILED_AT)

    rows = _rows()
    rows["i98e-djp9"] = rows["i98e-djp9"] * 6
    with pytest.raises(DataSFCompileError, match="5-row limit"):
        DataSFCompiler().compile(_artifacts(rows), COMPILED_AT)


def test_compiler_requires_all_seven_source_projections() -> None:
    with pytest.raises(DataSFCompileError, match="missing DataSF projections: vw6y-z8j6"):
        DataSFCompiler().compile(_artifacts()[:-1], COMPILED_AT)


@pytest.mark.parametrize("dataset_id", ["fizh-zaxt", "vw6y-z8j6"])
def test_compiler_rejects_a_projection_queried_for_another_site(dataset_id: str) -> None:
    artifacts = list(_artifacts())
    wrong_queries = {
        query.dataset_id: query
        for query in dependent_queries(
            "3956008",
            Point(longitude=-122.402024, latitude=37.765725),
            COMPILED_AT,
        )
    }
    index = next(
        index for index, artifact in enumerate(artifacts) if artifact.dataset_id == dataset_id
    )
    original = artifacts[index]
    artifacts[index] = DataSFArtifact.from_rows(
        dataset_id=dataset_id,
        query_url=wrong_queries[dataset_id].url,
        retrieved_at=original.retrieved_at,
        source_updated_at=original.source_updated_at,
        rows=original.rows,
    )

    with pytest.raises(DataSFCompileError, match="canonical parcel query plan"):
        DataSFCompiler().compile(artifacts, COMPILED_AT)


class _SingleContextRepository:
    def __init__(self, graph: ContextGraph) -> None:
        self._graph = graph
        self._evidence = {record.id: record for record in graph.evidence}

    @property
    def release_id(self) -> str:
        return self._graph.release.id

    @property
    def mock(self) -> bool:
        return self._graph.release.mock

    def list_sites(self) -> list[SiteSummary]:
        return [self._graph.site]

    def get_context(self, parcel_id: str, focus: str) -> ContextGraph:
        if parcel_id != self._graph.site.parcel_id:
            raise NotFoundError(parcel_id)
        if focus != "overview":
            raise InvalidFocusError(focus)
        return self._graph

    def get_evidence(self, evidence_id: str) -> EvidenceRecord:
        try:
            return self._evidence[evidence_id]
        except KeyError as error:
            raise NotFoundError(evidence_id) from error
