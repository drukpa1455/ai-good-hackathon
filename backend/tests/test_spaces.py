from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

import pytest
from botocore.exceptions import ClientError

from groundwork.datasf import DataSFArtifact, parcel_query
from groundwork.spaces import SpacesArtifactError, SpacesArtifactStore

NOW = datetime(2026, 7, 11, 12, 0, tzinfo=UTC)


class FakeS3:
    def __init__(self) -> None:
        self.objects: dict[str, dict[str, Any]] = {}
        self.puts: list[dict[str, Any]] = []

    def head_object(self, *, Bucket: str, Key: str) -> dict[str, Any]:
        del Bucket
        try:
            return self.objects[Key]
        except KeyError as error:
            raise ClientError(
                {"Error": {"Code": "404", "Message": "not found"}},
                "HeadObject",
            ) from error

    def put_object(self, **kwargs: Any) -> dict[str, Any]:
        self.puts.append(kwargs)
        self.objects[kwargs["Key"]] = {
            "ContentLength": len(kwargs["Body"]),
            "Metadata": kwargs["Metadata"],
        }
        return {}


def _artifact() -> DataSFArtifact:
    return DataSFArtifact.from_rows(
        dataset_id="acdm-wktn",
        query_url=parcel_query("3956008").url,
        retrieved_at=NOW,
        source_updated_at=NOW,
        rows=[{"blklot": "3956008"}],
    )


def test_spaces_put_is_private_content_addressed_and_idempotent() -> None:
    async def scenario() -> None:
        client = FakeS3()
        store = SpacesArtifactStore(bucket="private-artifacts", client=client)
        artifact = _artifact()
        first = await store.put(artifact)
        repeated = await store.put(artifact)

        assert first == repeated
        assert first.object_key == f"datasf/acdm-wktn/{artifact.artifact_sha256}.json"
        assert first.query_url == artifact.query_url
        assert first.license_id == "PDDL-1.0"
        assert len(client.puts) == 1
        assert "ACL" not in client.puts[0]
        assert client.puts[0]["Metadata"] == {
            "sha256": artifact.artifact_sha256,
            "dataset-id": "acdm-wktn",
        }

    asyncio.run(scenario())


def test_spaces_rejects_conflicting_object_or_mutated_artifact() -> None:
    async def conflicting_object() -> None:
        client = FakeS3()
        artifact = _artifact()
        key = f"datasf/acdm-wktn/{artifact.artifact_sha256}.json"
        client.objects[key] = {
            "ContentLength": 1,
            "Metadata": {"sha256": artifact.artifact_sha256, "dataset-id": "acdm-wktn"},
        }
        store = SpacesArtifactStore(bucket="private-artifacts", client=client)
        with pytest.raises(SpacesArtifactError, match="metadata"):
            await store.put(artifact)

    async def mutated_artifact() -> None:
        artifact = _artifact()
        artifact.rows[0]["blklot"] = "9999999"
        store = SpacesArtifactStore(bucket="private-artifacts", client=FakeS3())
        with pytest.raises(SpacesArtifactError, match="changed"):
            await store.put(artifact)

    asyncio.run(conflicting_object())
    asyncio.run(mutated_artifact())


def test_spaces_credentials_cannot_be_sent_to_an_unapproved_endpoint() -> None:
    with pytest.raises(ValueError, match="DigitalOcean region"):
        SpacesArtifactStore.create(
            endpoint_url="https://attacker.example",
            region="tor1",
            bucket="groundwork-artifacts",
            access_key_id="secret-key",
            secret_access_key="secret-value",
        )
