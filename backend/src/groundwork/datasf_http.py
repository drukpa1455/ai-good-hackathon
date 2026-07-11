from __future__ import annotations

import asyncio
import json
from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime

import httpx2

from .datasf import DataSFArtifact, DataSFQuery

Clock = Callable[[], datetime]


class DataSFFetchError(RuntimeError):
    """A bounded DataSF request did not return a usable projection."""


class HttpDataSFClient:
    def __init__(
        self,
        *,
        app_token: str = "",
        client: httpx2.AsyncClient | None = None,
        clock: Clock | None = None,
        max_response_bytes: int = 1_048_576,
    ) -> None:
        self._app_token = app_token
        self._client = client or httpx2.AsyncClient(
            timeout=httpx2.Timeout(3.0, connect=2.0),
            limits=httpx2.Limits(max_connections=4, max_keepalive_connections=4),
            headers={"User-Agent": "groundwork-sf/1"},
        )
        self._owns_client = client is None
        self._clock = clock or (lambda: datetime.now(UTC))
        self._max_response_bytes = max_response_bytes

    async def fetch(self, query: DataSFQuery) -> DataSFArtifact:
        headers = {"X-App-Token": self._app_token} if self._app_token else None
        response_headers: Mapping[str, str] | None = None
        body: bytes | None = None
        for attempt in range(2):
            status, response_headers, body = await self._request(query.url, headers)
            if status != 429 and not 500 <= status <= 599:
                break
            if attempt == 1:
                raise DataSFFetchError("DataSF remained unavailable after one retry")
            await asyncio.sleep(_retry_delay(response_headers))

        if body is None or response_headers is None:
            raise DataSFFetchError("DataSF returned no response")
        try:
            value = json.loads(body)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise DataSFFetchError("DataSF returned invalid JSON") from error
        if not isinstance(value, list) or any(not isinstance(row, dict) for row in value):
            raise DataSFFetchError("DataSF projection must be a JSON array of objects")
        return DataSFArtifact.from_rows(
            dataset_id=query.dataset_id,
            query_url=query.url,
            retrieved_at=self._clock(),
            source_updated_at=_source_updated_at(response_headers),
            rows=value,
        )

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def _request(
        self, url: str, headers: Mapping[str, str] | None
    ) -> tuple[int, Mapping[str, str], bytes | None]:
        async with self._client.stream("GET", url, headers=headers) as response:
            if response.status_code != 429 and not 500 <= response.status_code <= 599:
                if response.status_code < 200 or response.status_code >= 300:
                    raise DataSFFetchError(
                        f"DataSF returned non-success status {response.status_code}"
                    )
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > self._max_response_bytes:
                        raise DataSFFetchError("DataSF response exceeded its byte limit")
                return response.status_code, response.headers, bytes(body)
            return response.status_code, response.headers, None


def _source_updated_at(headers: Mapping[str, str]) -> datetime | None:
    value = headers.get("x-soda2-truth-last-modified") or headers.get("last-modified")
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None
    if parsed.utcoffset() is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


def _retry_delay(headers: Mapping[str, str]) -> float:
    try:
        return min(max(float(headers.get("retry-after", "0.1")), 0.0), 1.0)
    except ValueError:
        return 0.1
