from __future__ import annotations

import asyncio
import hashlib
import re
from typing import Any
from urllib.parse import urlparse

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from .datasf import DATASET_REGISTRY, DataSFArtifact, canonical_projection_bytes
from .live_context import ArtifactReceipt


class SpacesArtifactError(RuntimeError):
    """A content-addressed Spaces object could not be verified."""


class SpacesArtifactStore:
    def __init__(self, *, bucket: str, client: Any) -> None:
        self._bucket = bucket
        self._client = client

    @classmethod
    def create(
        cls,
        *,
        endpoint_url: str,
        region: str,
        bucket: str,
        access_key_id: str,
        secret_access_key: str,
    ) -> SpacesArtifactStore:
        parsed = urlparse(endpoint_url)
        expected_host = f"{region}.digitaloceanspaces.com"
        if (
            parsed.scheme != "https"
            or parsed.hostname != expected_host
            or parsed.port not in (None, 443)
            or parsed.username
            or parsed.password
            or parsed.path not in ("", "/")
            or parsed.params
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("Spaces endpoint must be the configured DigitalOcean region")
        if not re.fullmatch(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]", bucket):
            raise ValueError("Spaces bucket name is invalid")
        client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            region_name=region,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            config=Config(
                connect_timeout=3,
                read_timeout=3,
                retries={"max_attempts": 1, "mode": "standard"},
                signature_version="s3v4",
                s3={"addressing_style": "virtual"},
            ),
        )
        return cls(bucket=bucket, client=client)

    async def put(self, artifact: DataSFArtifact) -> ArtifactReceipt:
        body = canonical_projection_bytes(artifact.rows)
        digest = hashlib.sha256(body).hexdigest()
        if digest != artifact.artifact_sha256:
            raise SpacesArtifactError("DataSF artifact changed after hashing")
        key = f"datasf/{artifact.dataset_id}/{digest}.json"
        return await asyncio.to_thread(
            self._put_and_verify,
            artifact.dataset_id,
            digest,
            key,
            body,
            artifact,
        )

    def _put_and_verify(
        self,
        dataset_id: str,
        digest: str,
        key: str,
        body: bytes,
        artifact: DataSFArtifact,
    ) -> ArtifactReceipt:
        head = self._head_or_none(key)
        if head is None:
            self._client.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=body,
                ContentType="application/json",
                Metadata={"sha256": digest, "dataset-id": dataset_id},
            )
            head = self._client.head_object(Bucket=self._bucket, Key=key)
        _verify_head(head, dataset_id, digest, len(body))
        return ArtifactReceipt(
            dataset_id=dataset_id,
            sha256=digest,
            object_key=key,
            byte_count=len(body),
            query_url=artifact.query_url,
            license_id=DATASET_REGISTRY[dataset_id].license_id,
            retrieved_at=artifact.retrieved_at,
            source_updated_at=artifact.source_updated_at,
        )

    def _head_or_none(self, key: str) -> dict[str, Any] | None:
        try:
            return self._client.head_object(Bucket=self._bucket, Key=key)
        except ClientError as error:
            code = str(error.response.get("Error", {}).get("Code", ""))
            if code in {"404", "NoSuchKey", "NotFound"}:
                return None
            raise SpacesArtifactError("Spaces HEAD failed") from error


def _verify_head(
    head: dict[str, Any], dataset_id: str, digest: str, byte_count: int
) -> None:
    metadata = {str(key).lower(): str(value) for key, value in head.get("Metadata", {}).items()}
    if (
        int(head.get("ContentLength", -1)) != byte_count
        or metadata.get("sha256") != digest
        or metadata.get("dataset-id") != dataset_id
    ):
        raise SpacesArtifactError("Spaces object metadata does not match its content address")
