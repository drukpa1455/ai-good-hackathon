#!/usr/bin/env python3
"""Validate the methodology Knowledge Base and managed-evaluation assets."""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RAG_DIR = ROOT / "rag"
EVALUATION_PATH = ROOT / "evaluations" / "groundwork-agent-v1.csv"
AGENT_INSTRUCTIONS_PATH = ROOT / "ops" / "agent-instructions.md"
AGENT_FUNCTION_ROUTE_PATH = ROOT / "ops" / "agent-function-route.json"

RAG_DOCUMENTS = (
    RAG_DIR / "methodology.md",
    RAG_DIR / "datasets.md",
    RAG_DIR / "graph-semantics.md",
    RAG_DIR / "responsible-use.md",
)

SITE_FACT_MARKERS = (
    "3956008",
    "3501006",
    "0161014",
    "300 de haro",
    "1939 market",
    "758 pacific",
    "772 pacific",
)

CANONICAL_SITE_MAP = {
    "300 Haro": "3956008",
    "300 De Haro": "3956008",
    "1939 Market": "3501006",
    "758 Pacific": "0161014",
    "772 Pacific": "0161014",
    "758/772 Pacific": "0161014",
}

AGENT_AMBIGUITY_CONTRACT = (
    "Match a canonical alias only when the entire normalized site identifier "
    "exactly equals a listed alias.",
    "Bare `Pacific`, `Market`, and `Haro` are ambiguous.",
    "Do not call `get-site-context`, choose an APN, or answer site facts for "
    "an ambiguous identifier.",
)
AGENT_RETRY_CONTRACT = "call the Function exactly one more time with that APN."
AGENT_RESPONSE_CONTRACT = (
    "Answer first and keep the final response under 120 words.",
    "Include only the requested facts and, when applicable, packet status, "
    "a material date or diagnostic, and relevant packet citations.",
    "Use at most four bullets; do not use tables, project-description dumps, "
    "internal reasoning, raw tool output, or unused graph fields.",
    "Finish required citations before optional context.",
    "If space is tight, omit optional detail; never cut a sentence or URL.",
)

ROUTE_AMBIGUITY_CONTRACT = (
    "Match a canonical alias only when the entire normalized site identifier "
    "exactly equals a listed alias.",
    "Bare Pacific, Market, and Haro are ambiguous; do not call this Function "
    "or choose an APN for them.",
)
ROUTE_RETRY_CONTRACT = "call exactly one more time with its APN."

ROUTE_CANONICAL_MAP = (
    "Canonical aliases: 300 Haro or 300 De Haro = APN 3956008; "
    "1939 Market = APN 3501006; 758 Pacific, 772 Pacific, or "
    "758/772 Pacific = APN 0161014."
)


@dataclass(frozen=True)
class CoverageGroup:
    name: str
    start: int
    stop: int
    expected_markers: tuple[str, ...]


COVERAGE_GROUPS = (
    CoverageGroup("factual grounding", 0, 12, ("function", "packet")),
    CoverageGroup("freshness", 12, 20, ("date", "fresh", "stale", "newer", "older")),
    CoverageGroup(
        "ambiguity",
        20,
        28,
        ("ask", "clarify", "request", "not_found", "cannot see"),
    ),
    CoverageGroup("refusal", 28, 36, ("decline", "do not", "no.")),
    CoverageGroup("injection", 36, 44, ("do not", "untrusted", "ignore")),
    CoverageGroup("methodology", 44, 50, ("assertion", "evidence", "methodology")),
)


def _validate_rag_documents(errors: list[str]) -> None:
    for path in RAG_DOCUMENTS:
        if not path.is_file():
            errors.append(f"missing RAG document: {path.relative_to(ROOT)}")
            continue
        content = path.read_text(encoding="utf-8")
        if not content.startswith("# "):
            errors.append(f"RAG document needs one top-level heading: {path.relative_to(ROOT)}")
        if len(content.strip()) < 500:
            errors.append(f"RAG document is unexpectedly short: {path.relative_to(ROOT)}")
        lowered = content.lower()
        for marker in SITE_FACT_MARKERS:
            if marker in lowered:
                errors.append(
                    f"site-specific marker {marker!r} found in methodology document "
                    f"{path.relative_to(ROOT)}"
                )


def _read_evaluation(errors: list[str]) -> list[dict[str, str]]:
    if not EVALUATION_PATH.is_file():
        errors.append(f"missing evaluation CSV: {EVALUATION_PATH.relative_to(ROOT)}")
        return []

    with EVALUATION_PATH.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != ["query", "expected_response"]:
            errors.append(
                "evaluation headers must be exactly: query,expected_response; "
                f"found {reader.fieldnames!r}"
            )
            return []
        return list(reader)


def _validate_evaluation(rows: list[dict[str, str]], errors: list[str]) -> None:
    if len(rows) != 50:
        errors.append(f"evaluation must contain exactly 50 rows; found {len(rows)}")

    queries: set[str] = set()
    for number, row in enumerate(rows, start=1):
        query = row["query"].strip()
        expected = row["expected_response"].strip()
        if not query:
            errors.append(f"row {number} has an empty query")
        if not expected:
            errors.append(f"row {number} has an empty expected_response")
        normalized = query.casefold()
        if normalized in queries:
            errors.append(f"row {number} duplicates query: {query!r}")
        queries.add(normalized)

    for group in COVERAGE_GROUPS:
        selected = rows[group.start : group.stop]
        if len(selected) != group.stop - group.start:
            errors.append(f"coverage group {group.name!r} is incomplete")
            continue
        for number, row in enumerate(selected, start=group.start + 1):
            expected = row["expected_response"].casefold()
            if not any(marker in expected for marker in group.expected_markers):
                errors.append(
                    f"row {number} does not express the {group.name!r} response contract"
                )


def _validate_agent_assets(errors: list[str]) -> None:
    instructions = AGENT_INSTRUCTIONS_PATH.read_text(encoding="utf-8")
    for clause in AGENT_AMBIGUITY_CONTRACT:
        if " ".join(clause.split()) not in " ".join(instructions.split()):
            errors.append(f"agent instructions are missing contract clause: {clause!r}")
    if AGENT_RETRY_CONTRACT not in " ".join(instructions.split()):
        errors.append("agent instructions are missing the one-retry contract")
    for clause in AGENT_RESPONSE_CONTRACT:
        if " ".join(clause.split()) not in " ".join(instructions.split()):
            errors.append(f"agent instructions are missing response clause: {clause!r}")

    try:
        route = json.loads(AGENT_FUNCTION_ROUTE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        errors.append(f"agent Function route is not valid JSON: {error}")
        return

    route_description = route.get("description", "")
    parameters = route.get("input_schema", {}).get("parameters", [])
    site_parameters = [parameter for parameter in parameters if parameter.get("name") == "site"]
    if len(site_parameters) != 1:
        errors.append("agent Function route must define exactly one site parameter")
        return

    site_description = site_parameters[0].get("description", "")
    for clause in ROUTE_AMBIGUITY_CONTRACT:
        if " ".join(clause.split()) not in " ".join(route_description.split()):
            errors.append(f"agent Function description is missing contract clause: {clause!r}")
        if " ".join(clause.split()) not in " ".join(site_description.split()):
            errors.append(f"agent site parameter is missing contract clause: {clause!r}")
    if ROUTE_RETRY_CONTRACT not in route_description:
        errors.append("agent Function description is missing the one-retry contract")

    instruction_lines = instructions.splitlines()
    for alias, apn in CANONICAL_SITE_MAP.items():
        if not any(alias in line and apn in line for line in instruction_lines):
            errors.append(f"agent instructions are missing canonical mapping {alias!r} -> {apn}")
    if ROUTE_CANONICAL_MAP not in site_description:
        errors.append("agent site parameter is missing the canonical demo-site map")


def main() -> int:
    errors: list[str] = []
    _validate_rag_documents(errors)
    rows = _read_evaluation(errors)
    _validate_evaluation(rows, errors)
    _validate_agent_assets(errors)

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    print(
        f"Validated {len(RAG_DOCUMENTS)} methodology documents and "
        f"{len(rows)} evaluation rows across {len(COVERAGE_GROUPS)} coverage groups, and "
        "the Agent instruction contracts."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
