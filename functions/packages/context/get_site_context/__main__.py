"""Bounded DigitalOcean Function adapter for the deterministic graph API."""

from __future__ import annotations

import hashlib
import json
import os
import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

ALLOWED_FOCUSES = frozenset(
    {"overview", "housing", "permits", "hazards", "neighborhood"}
)
APP_HOST_SUFFIX = ".ondigitalocean.app"
CONTEXT_PATH = "/internal/agent/context"
MAX_PACKET_BYTES = 65_536
MAX_RESPONSE_BYTES = 262_144
REQUEST_TIMEOUT_SECONDS = 5
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")


@dataclass(frozen=True)
class Settings:
    endpoint_url: str
    function_to_app_token: str


class AdapterError(ValueError):
    def __init__(self, status: str) -> None:
        self.status = status


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args: Any, **kwargs: Any) -> None:
        return None


def main(event: object, context: object) -> dict[str, dict[str, str | bool]]:
    """DigitalOcean Functions entry point; `context` is intentionally unused."""
    del context
    return _handle(event, None, _open_request)


def _handle(
    event: object,
    settings: Settings | None,
    opener: Callable[[Request, float], Any],
) -> dict[str, dict[str, str | bool]]:
    try:
        payload = _input_payload(event)
    except AdapterError as error:
        return _failure(error.status)

    try:
        resolved_settings = settings or _settings_from_environment()
        return _success(_retrieve_context(payload, resolved_settings, opener))
    except HTTPError as error:
        return _failure(_status_for_http(error.code))
    except (AdapterError, TimeoutError, URLError, OSError, ValueError):
        return _failure("unavailable")


def _input_payload(event: object) -> dict[str, str]:
    if not isinstance(event, Mapping):
        raise AdapterError("invalid_request")
    return {
        "site": _required_input(event, "site", 160),
        "focus": _optional_focus(event.get("focus")),
        "question": _required_input(event, "question", 2_000),
    }


def _required_input(event: Mapping[object, object], name: str, maximum: int) -> str:
    value = event.get(name)
    if not isinstance(value, str):
        raise AdapterError("invalid_request")
    normalized = value.strip()
    if not normalized or len(normalized) > maximum:
        raise AdapterError("invalid_request")
    return normalized


def _optional_focus(value: object) -> str:
    if value is None:
        return "overview"
    if not isinstance(value, str):
        raise AdapterError("invalid_request")
    normalized = value.strip().lower()
    if not normalized:
        return "overview"
    if len(normalized) > 32 or normalized not in ALLOWED_FOCUSES:
        raise AdapterError("invalid_request")
    return normalized


def _settings_from_environment() -> Settings:
    endpoint_url = os.getenv("APP_AGENT_CONTEXT_URL", "")
    token = os.getenv("FUNCTION_TO_APP_TOKEN", "")
    parsed = urlparse(endpoint_url)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or not parsed.hostname.endswith(APP_HOST_SUFFIX)
        or parsed.port not in (None, 443)
        or parsed.username
        or parsed.password
        or parsed.path != CONTEXT_PATH
        or parsed.params
        or parsed.query
        or parsed.fragment
        or not token.strip()
        or "\r" in token
        or "\n" in token
    ):
        raise AdapterError("unavailable")
    return Settings(endpoint_url=endpoint_url, function_to_app_token=token)


def _retrieve_context(
    payload: dict[str, str],
    settings: Settings,
    opener: Callable[[Request, float], Any],
) -> dict[str, str | bool]:
    request = Request(
        settings.endpoint_url,
        data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {settings.function_to_app_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with opener(request, REQUEST_TIMEOUT_SECONDS) as response:
        status = getattr(response, "status", 200)
        if not isinstance(status, int) or not 200 <= status < 300:
            raise AdapterError("unavailable")
        raw = response.read(MAX_RESPONSE_BYTES + 1)
    if not isinstance(raw, bytes) or len(raw) > MAX_RESPONSE_BYTES:
        raise AdapterError("unavailable")
    try:
        result = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise AdapterError("unavailable") from error
    return _validated_backend_packet(result)


def _validated_backend_packet(result: object) -> dict[str, str | bool]:
    if not isinstance(result, Mapping):
        raise AdapterError("unavailable")
    context_packet = _required_backend_string(
        result, "context_packet", MAX_PACKET_BYTES
    )
    graph_release_id = _required_backend_string(result, "graph_release_id", 160)
    packet_sha256 = _required_backend_string(result, "packet_sha256", 64)
    mock = result.get("mock")
    if type(mock) is not bool or not SHA256_PATTERN.fullmatch(packet_sha256):
        raise AdapterError("unavailable")
    if hashlib.sha256(context_packet.encode("utf-8")).hexdigest() != packet_sha256:
        raise AdapterError("unavailable")
    return {
        "context_packet": context_packet,
        "graph_release_id": graph_release_id,
        "mock": mock,
        "packet_sha256": packet_sha256,
    }


def _required_backend_string(
    result: Mapping[object, object], name: str, maximum_bytes: int
) -> str:
    value = result.get(name)
    if (
        not isinstance(value, str)
        or not value
        or len(value.encode("utf-8")) > maximum_bytes
    ):
        raise AdapterError("unavailable")
    return value


def _open_request(request: Request, timeout: float) -> Any:
    return build_opener(NoRedirect()).open(request, timeout=timeout)


def _status_for_http(status_code: int) -> str:
    if status_code == 400:
        return "invalid_request"
    if status_code == 404:
        return "not_found"
    if status_code == 413:
        return "context_too_large"
    return "unavailable"


def _success(packet: dict[str, str | bool]) -> dict[str, dict[str, str | bool]]:
    return {"body": {"status": "ok", **packet}}


def _failure(status: str) -> dict[str, dict[str, str | bool]]:
    return {
        "body": {
            "status": status,
            "context_packet": "",
            "graph_release_id": "",
            "mock": False,
            "packet_sha256": "",
        }
    }
