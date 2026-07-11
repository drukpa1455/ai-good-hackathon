from __future__ import annotations

import asyncio
from datetime import UTC, datetime

import httpx2
import pytest

from groundwork.datasf import parcel_query
from groundwork.datasf_http import DataSFFetchError, HttpDataSFClient

NOW = datetime(2026, 7, 11, 12, 0, tzinfo=UTC)
PARCEL_ROW = {
    "blklot": "3956008",
    "block_num": "3956",
    "lot_num": "008",
    "active": True,
    "centroid_latitude": "37.765725",
    "centroid_longitude": "-122.402024",
}


def test_client_returns_a_hashed_projection_with_response_provenance() -> None:
    async def scenario() -> None:
        requests: list[httpx2.Request] = []

        async def handler(request: httpx2.Request) -> httpx2.Response:
            requests.append(request)
            return httpx2.Response(
                200,
                json=[PARCEL_ROW],
                headers={"X-SODA2-Truth-Last-Modified": "Sat, 11 Jul 2026 17:12:48 GMT"},
            )

        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as transport:
            client = HttpDataSFClient(
                app_token="private-app-token",
                client=transport,
                clock=lambda: NOW,
            )
            query = parcel_query("3956008")
            artifact = await client.fetch(query)

        assert len(requests) == 1
        assert requests[0].headers["x-app-token"] == "private-app-token"
        assert "private-app-token" not in str(requests[0].url)
        assert artifact.dataset_id == "acdm-wktn"
        assert artifact.query_url == query.url
        assert artifact.retrieved_at == NOW
        assert artifact.source_updated_at == datetime(2026, 7, 11, 17, 12, 48, tzinfo=UTC)
        assert len(artifact.artifact_sha256) == 64

    asyncio.run(scenario())


def test_client_retries_429_or_5xx_once_and_no_other_status() -> None:
    async def retry_scenario(status: int) -> None:
        calls = 0

        async def handler(_request: httpx2.Request) -> httpx2.Response:
            nonlocal calls
            calls += 1
            if calls == 1:
                return httpx2.Response(status, headers={"Retry-After": "0"})
            return httpx2.Response(200, json=[PARCEL_ROW])

        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as transport:
            client = HttpDataSFClient(client=transport, clock=lambda: NOW)
            await client.fetch(parcel_query("3956008"))
        assert calls == 2

    asyncio.run(retry_scenario(429))
    asyncio.run(retry_scenario(503))

    async def no_retry_scenario() -> None:
        calls = 0

        async def handler(_request: httpx2.Request) -> httpx2.Response:
            nonlocal calls
            calls += 1
            return httpx2.Response(400)

        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as transport:
            client = HttpDataSFClient(client=transport, clock=lambda: NOW)
            with pytest.raises(DataSFFetchError, match="status 400"):
                await client.fetch(parcel_query("3956008"))
        assert calls == 1

    asyncio.run(no_retry_scenario())


def test_client_rejects_oversized_or_malformed_payloads() -> None:
    async def scenario(payload: bytes, expected: str, limit: int = 128) -> None:
        async def handler(_request: httpx2.Request) -> httpx2.Response:
            return httpx2.Response(200, content=payload)

        async with httpx2.AsyncClient(transport=httpx2.MockTransport(handler)) as transport:
            client = HttpDataSFClient(
                client=transport,
                clock=lambda: NOW,
                max_response_bytes=limit,
            )
            with pytest.raises(DataSFFetchError, match=expected):
                await client.fetch(parcel_query("3956008"))

    asyncio.run(scenario(b"[" + b" " * 256 + b"]", "byte limit"))
    asyncio.run(scenario(b"not-json", "invalid JSON"))
    asyncio.run(scenario(b'{"not":"an array"}', "array of objects"))
