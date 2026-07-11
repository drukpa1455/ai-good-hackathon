from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import TYPE_CHECKING, Any, Protocol
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from ..contracts import Point, Sha256

if TYPE_CHECKING:
    from .registry import DataSFQuery


def canonical_projection_bytes(rows: Sequence[Mapping[str, Any]]) -> bytes:
    """Return the one canonical byte representation used for artifact identity."""
    try:
        return json.dumps(
            list(rows),
            allow_nan=False,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
    except (TypeError, ValueError) as error:
        raise ValueError("DataSF projection must contain only JSON values") from error


class DataSFArtifact(BaseModel):
    """A bounded SODA projection plus the metadata needed to prove its origin."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    dataset_id: str = Field(pattern=r"^[a-z0-9]{4}-[a-z0-9]{4}$")
    query_url: str
    retrieved_at: datetime
    source_updated_at: datetime | None
    rows: tuple[dict[str, Any], ...]
    artifact_sha256: Sha256

    @classmethod
    def from_rows(
        cls,
        *,
        dataset_id: str,
        query_url: str,
        retrieved_at: datetime,
        source_updated_at: datetime | None,
        rows: Sequence[Mapping[str, Any]],
    ) -> DataSFArtifact:
        copied_rows = tuple(dict(row) for row in rows)
        digest = hashlib.sha256(canonical_projection_bytes(copied_rows)).hexdigest()
        return cls(
            dataset_id=dataset_id,
            query_url=query_url,
            retrieved_at=retrieved_at,
            source_updated_at=source_updated_at,
            rows=copied_rows,
            artifact_sha256=digest,
        )

    @field_validator("query_url")
    @classmethod
    def validate_query_url(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme != "https" or parsed.netloc != "data.sfgov.org":
            raise ValueError("DataSF query URL must use the official HTTPS host")
        return value

    @field_validator("retrieved_at", "source_updated_at")
    @classmethod
    def validate_aware_datetime(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.utcoffset() is None:
            raise ValueError("DataSF artifact timestamps must include a UTC offset")
        return value

    @model_validator(mode="after")
    def validate_identity(self) -> DataSFArtifact:
        expected_path = f"/resource/{self.dataset_id}.json"
        if urlparse(self.query_url).path != expected_path:
            raise ValueError("DataSF query URL does not match artifact dataset")
        digest = hashlib.sha256(canonical_projection_bytes(self.rows)).hexdigest()
        if digest != self.artifact_sha256:
            raise ValueError("DataSF artifact hash does not match its canonical projection")
        return self


class DataSFParcelSeed(BaseModel):
    """Validated parcel identity needed to build the six location-dependent queries."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    parcel_id: str = Field(pattern=r"^[0-9]{7}$")
    centroid: Point


class DataSFClient(Protocol):
    """Stage 2 network boundary; implementations fetch exactly one declared query."""

    async def fetch(self, query: DataSFQuery) -> DataSFArtifact: ...
