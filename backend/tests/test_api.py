import json
import logging
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from groundwork.api import BackendSettings, create_app
from groundwork.contracts import (
    FOCUS_VALUES,
    ContextGraph,
    DataStatusResponse,
    SiteDataStatus,
)
from groundwork.repository import JsonReleaseRepository, filter_by_focus


@pytest.fixture
def client() -> TestClient:
    root = Path(__file__).resolve().parents[2]
    settings = BackendSettings(
        release_dir=root / "data/releases/demo-v1",
        static_dir=None,
        git_sha="test-sha",
        function_token="function-secret",
    )
    return TestClient(create_app(settings, request_id_factory=lambda: "req-test-0001"))


def test_health_and_runtime_config_are_deployment_readbacks(client: TestClient) -> None:
    health = client.get("/healthz")
    assert health.status_code == 200
    assert health.json() == {
        "status": "ok",
        "git_sha": "test-sha",
        "graph_release_id": "mock-release-0001",
        "data_mode": "api",
        "mock": True,
    }
    assert health.headers["x-request-id"] == "req-test-0001"

    runtime = client.get("/api/runtime-config").json()
    assert runtime["data_mode"] == "api"
    assert runtime["agent"]["enabled"] is False
    assert runtime["agent"]["primary_color"] == "#5b4bc4"
    assert runtime["agent"]["secondary_color"] == "#1a1822"
    assert runtime["agent"]["button_background_color"] == "#5b4bc4"


def test_public_context_contract(client: TestClient) -> None:
    sites = client.get("/api/sites")
    assert sites.status_code == 200
    parcel_ids = [site["parcel_id"] for site in sites.json()]
    assert parcel_ids == ["3956008", "3501006", "0161014"]

    for parcel_id in parcel_ids:
        for focus in FOCUS_VALUES:
            response = client.get(f"/api/sites/{parcel_id}/context?focus={focus}")
            assert response.status_code == 200
            context = response.json()
            assert context["schema_version"] == "1.0"
            assert context["site"]["parcel_id"] == parcel_id
            assert context["focus"] == focus
            assert context["release"]["mock"] is True

    evidence = client.get("/api/evidence/ev-6jgi-cpb4-3956008")
    assert evidence.status_code == 200
    assert evidence.json()["dataset_id"] == "6jgi-cpb4"

    status = client.get("/api/data-status")
    assert status.status_code == 200
    assert status.json()["live_data_enabled"] is False
    assert [site["status"] for site in status.json()["sites"]] == [
        "fixture",
        "fixture",
        "fixture",
    ]


def test_public_errors_use_frozen_shape_and_request_id(client: TestClient) -> None:
    invalid = client.get(
        "/api/sites/3956008/context?focus=ranking",
        headers={"X-Request-ID": "req-caller-1"},
    )
    assert invalid.status_code == 400
    assert invalid.json() == {
        "code": "invalid_focus",
        "message": "Unknown focus ranking",
        "request_id": "req-caller-1",
    }
    assert invalid.headers["x-request-id"] == "req-caller-1"

    missing = client.get("/api/evidence/ev-nope")
    assert missing.status_code == 404
    assert missing.json()["code"] == "not_found"


def test_agent_context_requires_function_credential(client: TestClient) -> None:
    payload = {
        "site": "3956008",
        "focus": "overview",
        "question": "What changed and what remains uncertain?",
    }
    unauthorized = client.post("/internal/agent/context", json=payload)
    assert unauthorized.status_code == 401
    assert unauthorized.headers["www-authenticate"] == "Bearer"

    response = client.post(
        "/internal/agent/context",
        json=payload,
        headers={"Authorization": "Bearer function-secret"},
    )
    assert response.status_code == 200
    packet = response.json()
    assert packet["mock"] is True
    assert packet["graph_release_id"] == "mock-release-0001"
    assert len(packet["packet_sha256"]) == 64
    assert "Source URL:" in packet["context_packet"]


def test_request_log_is_safe_and_contains_release_metadata(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger="groundwork.api"):
        response = client.post(
            "/internal/agent/context",
            json={
                "site": "3956008",
                "focus": "overview",
                "question": "Do not log this private prompt.",
            },
            headers={"Authorization": "Bearer function-secret"},
        )

    assert response.status_code == 200
    log = next(
        json.loads(record.getMessage())
        for record in caplog.records
        if '"event":"request_complete"' in record.getMessage()
    )
    assert log["graph_release_id"] == "mock-release-0001"
    assert log["packet_sha256"] == response.json()["packet_sha256"]
    assert log["status_code"] == 200
    assert "private prompt" not in caplog.text
    assert "function-secret" not in caplog.text


def test_widget_enables_only_with_complete_public_config() -> None:
    root = Path(__file__).resolve().parents[2]
    settings = BackendSettings(
        release_dir=root / "data/releases/demo-v1",
        static_dir=None,
        agent_enabled=True,
        agent_script_url="https://example.com/widget.js",
        agent_id="agent-public-id",
        chatbot_id="chatbot-public-id",
    )
    client = TestClient(create_app(settings, request_id_factory=lambda: "req-test"))
    assert client.get("/api/runtime-config").json()["agent"]["enabled"] is True


def test_spa_fallback_serves_deep_links_and_static_assets(tmp_path: Path) -> None:
    root = Path(__file__).resolve().parents[2]
    static = tmp_path / "dist"
    assets = static / "assets"
    assets.mkdir(parents=True)
    (static / "index.html").write_text("<html>demo shell</html>")
    (assets / "app.js").write_text("console.log('demo')")
    settings = BackendSettings(
        release_dir=root / "data/releases/demo-v1",
        static_dir=static,
    )
    client = TestClient(create_app(settings, request_id_factory=lambda: "req-test"))

    assert client.get("/sites/3956008").text == "<html>demo shell</html>"
    assert client.get("/evidence/ev-6jgi-cpb4-3956008").text == "<html>demo shell</html>"
    assert client.get("/assets/app.js").text == "console.log('demo')"
    assert client.get("/api/unknown").status_code == 404


class RecordingLiveService:
    def __init__(self, repository: JsonReleaseRepository) -> None:
        self.repository = repository
        self.calls: list[tuple[str, str]] = []
        fixture = repository.get_context("3956008", "overview")
        payload = fixture.model_dump(mode="json")
        payload["release"].update(
            {
                "id": "live-test-release",
                "compiler_version": "datasf-test",
                "mock": False,
                "data_status": "live",
            }
        )
        payload["trust"]["graph_release_id"] = "live-test-release"
        self.context = ContextGraph.model_validate(payload)

    async def get_context(self, parcel_id: str, focus: str) -> ContextGraph:
        self.calls.append((parcel_id, focus))
        return filter_by_focus(self.context, focus)

    async def get_evidence(self, evidence_id: str):
        return self.repository.get_evidence(evidence_id)

    async def data_status(self, parcel_ids: list[str]) -> DataStatusResponse:
        return DataStatusResponse(
            live_data_enabled=True,
            sites=[
                SiteDataStatus(
                    parcel_id=parcel_id,
                    status="live",
                    graph_release_id="live-test-release",
                    published_at="2026-07-11T12:00:00+00:00",
                    source_cutoff_at="2026-07-11T12:00:00+00:00",
                    last_refresh_started_at="2026-07-11T11:59:59+00:00",
                    last_refresh_completed_at="2026-07-11T12:00:00+00:00",
                    last_error_code=None,
                )
                for parcel_id in parcel_ids
            ],
        )


def test_live_scope_is_featured_public_but_exact_apn_for_authenticated_function() -> None:
    root = Path(__file__).resolve().parents[2]
    repository = JsonReleaseRepository.load(root / "data/releases/demo-v1")
    live = RecordingLiveService(repository)
    settings = BackendSettings(
        release_dir=root / "data/releases/demo-v1",
        static_dir=None,
        function_token="function-secret",
    )
    client = TestClient(
        create_app(settings, request_id_factory=lambda: "req-live", live_service=live)
    )

    public = client.get("/api/sites/9999999/context")
    assert public.status_code == 404
    assert live.calls == []

    internal = client.post(
        "/internal/agent/context",
        headers={"Authorization": "Bearer function-secret"},
        json={"site": "9999999", "focus": "overview", "question": "What is here?"},
    )
    assert internal.status_code == 200
    assert live.calls == [("9999999", "overview")]
    assert internal.json()["data_status"] == "live"
    assert internal.json()["mock"] is False
    assert "LIVE DATASF PROJECTIONS" in internal.json()["context_packet"]

    status = client.get("/api/data-status").json()
    assert status["live_data_enabled"] is True
    assert all(site["status"] == "live" for site in status["sites"])


def test_live_mode_fails_fast_without_database_or_spaces_configuration() -> None:
    root = Path(__file__).resolve().parents[2]
    settings = BackendSettings(
        release_dir=root / "data/releases/demo-v1",
        static_dir=None,
        live_data_enabled=True,
    )
    with pytest.raises(ValueError, match="DATABASE_URL"):
        create_app(settings)
