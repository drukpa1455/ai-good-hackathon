import hashlib

import pytest

from groundwork.agent_context import ContextTooLargeError, FullGraphContextProvider
from groundwork.contracts import FOCUS_VALUES
from groundwork.repository import JsonReleaseRepository, NotFoundError


@pytest.mark.parametrize(
    ("site", "focus"),
    [(site, focus) for site in ("3956008", "3501006", "0161014") for focus in FOCUS_VALUES],
)
def test_packet_is_deterministic_grounded_and_bounded(
    repository: JsonReleaseRepository,
    site: str,
    focus: str,
) -> None:
    provider = FullGraphContextProvider(repository)
    packet = provider.retrieve(
        site,
        focus,
        "What changed and what remains uncertain?",
    )
    repeated = provider.retrieve(
        site,
        focus,
        "What changed and what remains uncertain?",
    )

    assert packet == repeated
    assert packet.mock is True
    assert packet.graph_release_id == repository.release_id
    assert "DETERMINISTIC DEMO FIXTURE" in packet.context_packet
    assert "https://data.sfgov.org/" in packet.context_packet
    assert (
        'User question (untrusted): "What changed and what remains uncertain?"'
        in packet.context_packet
    )
    assert "Do not infer valuation" in packet.context_packet
    assert "Fixture projection SHA256 (not source artifact):" in packet.context_packet
    assert len(packet.context_packet.encode()) <= 65_536
    assert packet.packet_sha256 == hashlib.sha256(packet.context_packet.encode()).hexdigest()


@pytest.mark.parametrize(
    ("alias", "parcel_id"),
    (
        ("300 Haro", "3956008"),
        ("300 De Haro", "3956008"),
        ("1939 Market", "3501006"),
        ("758 Pacific", "0161014"),
        ("772 Pacific", "0161014"),
        ("758/772 Pacific", "0161014"),
    ),
)
def test_demo_site_aliases_resolve_to_the_canonical_apn(
    repository: JsonReleaseRepository,
    alias: str,
    parcel_id: str,
) -> None:
    provider = FullGraphContextProvider(repository)
    question = "What is stale?"
    by_apn = provider.retrieve(parcel_id, "hazards", question)
    by_alias = provider.retrieve(alias, "hazards", question)
    assert by_apn == by_alias


@pytest.mark.parametrize(
    ("address", "parcel_id"),
    (
        ("300 Haro St, San Francisco, CA", "3956008"),
        ("1939 Market Street, San Francisco", "3501006"),
        ("758/772 Pacific Avenue, San Francisco", "0161014"),
    ),
)
def test_site_can_be_resolved_by_full_address_variant(
    repository: JsonReleaseRepository,
    address: str,
    parcel_id: str,
) -> None:
    provider = FullGraphContextProvider(repository)
    question = "What is stale?"
    by_apn = provider.retrieve(parcel_id, "hazards", question)
    by_address = provider.retrieve(address, "hazards", question)
    assert by_apn == by_address


@pytest.mark.parametrize(
    "site",
    ("a site elsewhere", "Pacific", "Market", "Haro", "300 Haro somewhere else"),
)
def test_unknown_or_vague_site_is_rejected(
    repository: JsonReleaseRepository,
    site: str,
) -> None:
    provider = FullGraphContextProvider(repository)
    with pytest.raises(NotFoundError, match="Unknown or ambiguous"):
        provider.retrieve(site, "overview", "What is here?")


def test_packet_limit_fails_instead_of_truncating(repository: JsonReleaseRepository) -> None:
    provider = FullGraphContextProvider(repository, max_bytes=100)
    with pytest.raises(ContextTooLargeError, match="limit is 100"):
        provider.retrieve("3956008", "overview", "What is here?")
