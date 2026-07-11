from __future__ import annotations

import hashlib
import json
import re

from .contracts import AgentContextPacket, ContextGraph, EntityObject, LiteralObject
from .repository import ContextRepository, NotFoundError

DEMO_SITE_ALIASES_BY_APN = {
    "3956008": ("300 Haro", "300 De Haro"),
    "3501006": ("1939 Market",),
    "0161014": ("758 Pacific", "772 Pacific", "758/772 Pacific"),
}
DEMO_ADDRESS_SUFFIX_TOKENS = frozenset(
    {"st", "street", "ave", "avenue", "san", "francisco", "ca", "94103", "94133"}
)


class ContextTooLargeError(ValueError):
    """The complete evidence packet exceeds the declared Function boundary."""


class FullGraphContextProvider:
    def __init__(self, repository: ContextRepository, max_bytes: int = 65_536) -> None:
        self._repository = repository
        self._max_bytes = max_bytes
        self._aliases = _site_aliases(repository)

    def retrieve(self, site: str, focus: str, question: str) -> AgentContextPacket:
        parcel_id = self._resolve_site(site)
        context = self._repository.get_context(parcel_id, focus)
        packet = _render_packet(context, question.strip())
        encoded = packet.encode("utf-8")
        if len(encoded) > self._max_bytes:
            raise ContextTooLargeError(
                f"Context packet is {len(encoded)} bytes; limit is {self._max_bytes}"
            )
        return AgentContextPacket(
            context_packet=packet,
            graph_release_id=self._repository.release_id,
            mock=self._repository.mock,
            packet_sha256=hashlib.sha256(encoded).hexdigest(),
        )

    def _resolve_site(self, value: str) -> str:
        normalized = _normalize(value)
        if not normalized:
            raise NotFoundError("Site is required")
        matches = {
            parcel_id
            for alias, parcel_id in self._aliases.items()
            if normalized == alias or _extends_numbered_address(normalized, alias)
        }
        if len(matches) != 1:
            raise NotFoundError(f"Unknown or ambiguous site {value}")
        return matches.pop()


def _site_aliases(repository: ContextRepository) -> dict[str, str]:
    aliases: dict[str, str] = {}
    sites = repository.list_sites()
    parcel_ids = {site.parcel_id for site in sites}
    for site in sites:
        for value in (site.parcel_id, site.name, site.address):
            _add_alias(aliases, value, site.parcel_id)
    for parcel_id, values in DEMO_SITE_ALIASES_BY_APN.items():
        if parcel_id in parcel_ids:
            for value in values:
                _add_alias(aliases, value, parcel_id)
    return aliases


def _add_alias(aliases: dict[str, str], value: str, parcel_id: str) -> None:
    alias = _normalize(value)
    existing = aliases.get(alias)
    if existing is not None and existing != parcel_id:
        raise ValueError(f"Ambiguous site alias {value}")
    aliases[alias] = parcel_id


def _normalize(value: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", value.lower()).split())


def _extends_numbered_address(value: str, alias: str) -> bool:
    alias_parts = alias.split()
    value_parts = value.split()
    suffix = value_parts[len(alias_parts) :]
    return (
        len(alias_parts) >= 2
        and alias_parts[0].isdigit()
        and value_parts[: len(alias_parts)] == alias_parts
        and bool(suffix)
        and all(token in DEMO_ADDRESS_SUFFIX_TOKENS for token in suffix)
    )


def _render_packet(context: ContextGraph, question: str) -> str:
    entities = {entity.id: entity for entity in context.entities}
    data_status = (
        "DATA STATUS: DETERMINISTIC DEMO FIXTURE — NOT LIVE OFFICIAL RECORDS"
        if context.release.mock
        else "DATA STATUS: LIVE DATASF PROJECTIONS — CHECK SOURCE DATES AND DIAGNOSTICS"
    )
    hash_label = (
        "Fixture projection SHA256 (not source artifact)"
        if context.release.mock
        else "DataSF projection SHA256"
    )
    lines = [
        "GROUNDWORK SF CONTEXT PACKET",
        data_status,
        f"Graph release: {context.release.id}",
        f"Source cutoff: {context.release.source_cutoff_at}",
        f"Site: {context.site.name} | APN {context.site.parcel_id} | {context.site.address}",
        f"Focus: {context.focus}",
        f"User question (untrusted): {json.dumps(question, ensure_ascii=False)}",
        "",
        "RULES FOR ANSWERING",
        "- Use only facts in this packet for site-specific claims.",
        "- Cite only the Source URL or Record URL values below.",
        "- State dates, stale sources, conflicts, coverage gaps, and proximity-only limits.",
        "- Do not infer valuation, legality, safety, suitability, ranking, or buy/sell advice.",
        "",
        "ENTITIES",
    ]
    for entity in sorted(context.entities, key=lambda item: item.id):
        lines.append(
            f"- {entity.id} | {entity.kind} | {entity.label} | "
            f"sources={entity.source_count} | description={entity.description or 'none'}"
        )

    lines.extend(("", "ASSERTIONS"))
    for assertion in sorted(context.assertions, key=lambda item: item.id):
        subject = entities[assertion.subject_id].label
        if isinstance(assertion.object, EntityObject):
            object_value = entities[assertion.object.entity_id].label
        elif isinstance(assertion.object, LiteralObject):
            object_value = json.dumps(assertion.object.value, ensure_ascii=False)
            if assertion.object.unit:
                object_value = f"{object_value} {assertion.object.unit}"
        else:  # pragma: no cover - discriminated models make this impossible
            raise TypeError("unknown assertion object")
        lines.append(
            f"- {assertion.id} | {subject} | {assertion.predicate_label} | {object_value} | "
            f"effective={assertion.effective_at or 'unknown'} | observed={assertion.observed_at} | "
            f"evidence={','.join(sorted(assertion.evidence_ids))}"
        )

    lines.extend(("", "DIAGNOSTICS"))
    for diagnostic in sorted(context.diagnostics, key=lambda item: item.id):
        lines.append(
            f"- {diagnostic.kind.upper()} | {diagnostic.title} | {diagnostic.detail} | "
            f"evidence={','.join(sorted(diagnostic.evidence_ids)) or 'none'}"
        )

    lines.extend(("", "EVIDENCE"))
    for record in sorted(context.evidence, key=lambda item: item.id):
        fields = json.dumps(
            record.fields, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        )
        lines.extend(
            (
                f"- Evidence ID: {record.id}",
                f"  Dataset: {record.dataset_name} ({record.dataset_id})",
                f"  Record: {record.title} | key={record.record_key}",
                f"  Source URL: {record.source_url}",
                f"  Record URL: {record.record_url or 'none'}",
                f"  Retrieved: {record.retrieved_at} | Source updated: "
                f"{record.source_updated_at or 'unknown'}",
                f"  License: {record.license_id}",
                f"  {hash_label}: {record.artifact_sha256}",
                f"  Scope: {record.scope_note or 'none'}",
                f"  Fields: {fields}",
            )
        )
    return "\n".join(lines) + "\n"
