from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError

FUNCTIONS_ROOT = Path(__file__).resolve().parents[1]
HANDLER_PATH = FUNCTIONS_ROOT / "packages/context/get_site_context/__main__.py"
MODULE_NAME = "groundwork_get_site_context"


def load_handler():
    spec = importlib.util.spec_from_file_location(MODULE_NAME, HANDLER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load Function handler")
    module = importlib.util.module_from_spec(spec)
    sys.modules[MODULE_NAME] = module
    spec.loader.exec_module(module)
    return module


HANDLER = load_handler()
ENVIRONMENT = {
    "APP_AGENT_CONTEXT_URL": "https://groundwork.ondigitalocean.app/internal/agent/context",
    "FUNCTION_TO_APP_TOKEN": "adapter-secret",
}


class FakeResponse:
    def __init__(self, payload: bytes, status: int = 200) -> None:
        self.payload = payload
        self.status = status
        self.read_limit: int | None = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self, limit: int) -> bytes:
        self.read_limit = limit
        return self.payload


class RecordingOpener:
    def __init__(self, response: FakeResponse | Exception) -> None:
        self.response = response
        self.calls: list[tuple[object, float]] = []

    def __call__(self, request, timeout: float):
        self.calls.append((request, timeout))
        if isinstance(self.response, Exception):
            raise self.response
        return self.response


def backend_packet(packet: str = "bounded packet") -> bytes:
    return json.dumps(
        {
            "context_packet": packet,
            "graph_release_id": "mock-release-0001",
            "mock": True,
            "packet_sha256": hashlib.sha256(packet.encode()).hexdigest(),
        }
    ).encode()


class GetSiteContextTests(unittest.TestCase):
    def call(
        self,
        event: object,
        opener: RecordingOpener,
        environment: dict[str, str] | None = None,
    ):
        with patch.dict(os.environ, environment or ENVIRONMENT, clear=True):
            return HANDLER._handle(event, HANDLER._settings_from_environment(), opener)

    def test_success_forwards_only_the_bounded_scalar_contract_once(self) -> None:
        opener = RecordingOpener(FakeResponse(backend_packet()))
        result = self.call(
            {
                "site": " 3956008 ",
                "focus": "HOUSING",
                "question": "  What changed? ",
                "http": {"headers": "ignored framework metadata"},
            },
            opener,
        )

        self.assertEqual(result["body"]["status"], "ok")
        self.assertEqual(len(opener.calls), 1)
        request, timeout = opener.calls[0]
        self.assertEqual(timeout, 5)
        self.assertEqual(request.full_url, ENVIRONMENT["APP_AGENT_CONTEXT_URL"])
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(
            json.loads(request.data),
            {
                "site": "3956008",
                "focus": "housing",
                "question": "What changed?",
            },
        )
        headers = {key.lower(): value for key, value in request.header_items()}
        self.assertEqual(headers["authorization"], "Bearer adapter-secret")
        self.assertEqual(headers["content-type"], "application/json")
        self.assertEqual(headers["accept"], "application/json")

    def test_platform_entry_point_uses_the_same_adapter_path(self) -> None:
        opener = RecordingOpener(FakeResponse(backend_packet()))
        with (
            patch.dict(os.environ, ENVIRONMENT, clear=True),
            patch.object(HANDLER, "_open_request", opener),
        ):
            result = HANDLER.main(
                {"site": "3956008", "question": "What changed?"}, None
            )
        self.assertEqual(result["body"]["status"], "ok")
        self.assertEqual(len(opener.calls), 1)

    def test_focus_defaults_to_overview(self) -> None:
        opener = RecordingOpener(FakeResponse(backend_packet()))
        self.call({"site": "3956008", "question": "What changed?"}, opener)
        request, _ = opener.calls[0]
        self.assertEqual(json.loads(request.data)["focus"], "overview")

    def test_invalid_inputs_do_not_contact_the_backend(self) -> None:
        invalid_events = (
            {},
            {"site": "", "question": "question"},
            {"site": 3956008, "question": "question"},
            {"site": "x" * 161, "question": "question"},
            {"site": "3956008", "focus": "ranking", "question": "question"},
            {"site": "3956008", "question": "x" * 2_001},
        )
        for event in invalid_events:
            with self.subTest(event=event):
                opener = RecordingOpener(FakeResponse(backend_packet()))
                result = self.call(event, opener)
                self.assertEqual(result["body"]["status"], "invalid_request")
                self.assertEqual(opener.calls, [])

    def test_backend_statuses_map_to_safe_scalar_statuses(self) -> None:
        expected = {
            400: "invalid_request",
            404: "not_found",
            413: "context_too_large",
            401: "unavailable",
            500: "unavailable",
        }
        for status_code, status in expected.items():
            with self.subTest(status_code=status_code):
                error = HTTPError(
                    "https://groundwork.ondigitalocean.app",
                    status_code,
                    "ignored",
                    {},
                    None,
                )
                opener = RecordingOpener(error)
                result = self.call({"site": "3956008", "question": "question"}, opener)
                self.assertEqual(result["body"]["status"], status)
                self.assertEqual(len(opener.calls), 1)

    def test_network_and_malformed_responses_fail_closed_without_retries(self) -> None:
        hash_mismatch = json.dumps(
            {
                "context_packet": "bounded packet",
                "graph_release_id": "mock-release-0001",
                "mock": True,
                "packet_sha256": "0" * 64,
            }
        ).encode()
        cases = (
            RecordingOpener(URLError("unreachable")),
            RecordingOpener(FakeResponse(b"not json")),
            RecordingOpener(FakeResponse(backend_packet("x" * 65_537))),
            RecordingOpener(FakeResponse(hash_mismatch)),
            RecordingOpener(FakeResponse(json.dumps({"context_packet": "x"}).encode())),
        )
        for opener in cases:
            with self.subTest(opener=opener):
                result = self.call({"site": "3956008", "question": "question"}, opener)
                self.assertEqual(result["body"]["status"], "unavailable")
                self.assertEqual(len(opener.calls), 1)

    def test_invalid_configuration_and_failures_do_not_expose_sensitive_values(
        self,
    ) -> None:
        environments = (
            {"FUNCTION_TO_APP_TOKEN": "adapter-secret"},
            {
                "APP_AGENT_CONTEXT_URL": "https://attacker.example/internal/agent/context",
                "FUNCTION_TO_APP_TOKEN": "adapter-secret",
            },
        )
        for environment in environments:
            with self.subTest(environment=environment):
                opener = RecordingOpener(FakeResponse(backend_packet()))
                with (
                    patch.dict(os.environ, environment, clear=True),
                    patch.object(HANDLER, "_open_request", opener),
                ):
                    result = HANDLER.main(
                        {"site": "3956008", "question": "secret question"},
                        context=None,
                    )
                rendered = json.dumps(result)
                self.assertEqual(result["body"]["status"], "unavailable")
                self.assertNotIn("adapter-secret", rendered)
                self.assertNotIn("secret question", rendered)
                self.assertEqual(opener.calls, [])

    def test_every_result_is_a_scalar_function_body(self) -> None:
        result = self.call(
            {"site": "", "question": "question"},
            RecordingOpener(FakeResponse(backend_packet())),
        )
        self.assertEqual(set(result), {"body"})
        self.assertEqual(
            set(result["body"]),
            {"status", "context_packet", "graph_release_id", "mock", "packet_sha256"},
        )
        self.assertTrue(
            all(isinstance(value, (str, bool)) for value in result["body"].values())
        )
