#!/usr/bin/env python3
"""Validate the methodology Knowledge Base and managed-evaluation assets."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RAG_DIR = ROOT / "rag"
EVALUATION_PATH = ROOT / "evaluations" / "groundwork-agent-v1.csv"

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


def main() -> int:
    errors: list[str] = []
    _validate_rag_documents(errors)
    rows = _read_evaluation(errors)
    _validate_evaluation(rows, errors)

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    print(
        f"Validated {len(RAG_DOCUMENTS)} methodology documents and "
        f"{len(rows)} evaluation rows across {len(COVERAGE_GROUPS)} coverage groups."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
