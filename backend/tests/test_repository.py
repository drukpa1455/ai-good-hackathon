import hashlib
import json
import shutil
from pathlib import Path

import pytest

from groundwork.contracts import FOCUS_VALUES, EntityObject
from groundwork.repository import (
    InvalidFocusError,
    JsonReleaseRepository,
    NotFoundError,
    ReleaseError,
)

SITE_IDS = ["3956008", "3501006", "0161014"]


def test_release_loads_all_sites_and_evidence(repository: JsonReleaseRepository) -> None:
    assert [site.parcel_id for site in repository.list_sites()] == SITE_IDS
    assert repository.release_id == "mock-release-0001"
    assert repository.mock is True

    for parcel_id in SITE_IDS:
        context = repository.get_context(parcel_id, "overview")
        evidence_ids = {record.id for record in context.evidence}
        assert context.release.mock is True
        assert context.trust.source_count == len(context.evidence)
        assert context.trust.assertion_count == len(context.assertions)
        assert context.trust.latest_agent_evaluation.status == "not_run"
        for assertion in context.assertions:
            assert assertion.evidence_ids
            assert set(assertion.evidence_ids) <= evidence_ids


@pytest.mark.parametrize(
    ("parcel_id", "focus"),
    [(site, focus) for site in SITE_IDS for focus in FOCUS_VALUES],
)
def test_focus_filter_matches_frontend_contract(
    repository: JsonReleaseRepository, parcel_id: str, focus: str
) -> None:
    context = repository.get_context(parcel_id, focus)
    assert context.focus == focus
    if focus == "overview":
        assert context.assertions
        return
    assert all(assertion.category in {focus, "identity"} for assertion in context.assertions)
    assert any(entity.kind == "parcel" for entity in context.entities)
    touched = {assertion.subject_id for assertion in context.assertions}
    touched.update(
        assertion.object.entity_id
        for assertion in context.assertions
        if isinstance(assertion.object, EntityObject)
    )
    assert all(entity.kind == "parcel" or entity.id in touched for entity in context.entities)


def test_unknown_objects_raise_typed_errors(repository: JsonReleaseRepository) -> None:
    with pytest.raises(NotFoundError, match="No site"):
        repository.get_context("9999999", "overview")
    with pytest.raises(NotFoundError, match="No evidence"):
        repository.get_evidence("ev-nope")
    with pytest.raises(InvalidFocusError, match="Unknown focus"):
        repository.get_context("3956008", "ranking")


def test_manifest_hash_detects_mutation(tmp_path: Path) -> None:
    source = Path(__file__).resolve().parents[2] / "data/releases/demo-v1"
    release = tmp_path / "release"
    shutil.copytree(source, release)
    with (release / "sites.json").open("a") as file:
        file.write("\n")
    with pytest.raises(ReleaseError, match="hash mismatch"):
        JsonReleaseRepository.load(release)


def test_referential_validation_detects_unknown_evidence(tmp_path: Path) -> None:
    source = Path(__file__).resolve().parents[2] / "data/releases/demo-v1"
    release = tmp_path / "release"
    shutil.copytree(source, release)
    context_path = release / "contexts/3956008.json"
    context = json.loads(context_path.read_text())
    context["assertions"][0]["evidence_ids"] = ["ev-does-not-exist"]
    context_path.write_text(json.dumps(context, indent=2) + "\n")

    manifest_path = release / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["files"]["contexts/3956008.json"] = hashlib.sha256(
        context_path.read_bytes()
    ).hexdigest()
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

    with pytest.raises(ReleaseError, match="unknown assertion evidence"):
        JsonReleaseRepository.load(release)


def test_referential_validation_requires_evidence_back_links(tmp_path: Path) -> None:
    source = Path(__file__).resolve().parents[2] / "data/releases/demo-v1"
    release = tmp_path / "release"
    shutil.copytree(source, release)
    context_path = release / "contexts/3956008.json"
    context = json.loads(context_path.read_text())
    context["evidence"][0]["assertion_ids"] = []
    context_path.write_text(json.dumps(context, indent=2) + "\n")

    manifest_path = release / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["files"]["contexts/3956008.json"] = hashlib.sha256(
        context_path.read_bytes()
    ).hexdigest()
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

    with pytest.raises(ReleaseError, match="invalid evidence back-reference"):
        JsonReleaseRepository.load(release)
