from pathlib import Path

import pytest

from groundwork.repository import JsonReleaseRepository


@pytest.fixture(scope="session")
def repository() -> JsonReleaseRepository:
    release_dir = Path(__file__).resolve().parents[2] / "data/releases/demo-v1"
    return JsonReleaseRepository.load(release_dir)
