# Context graph semantics

The context graph is a deterministic evidence model. Its smallest useful claim
is an assertion connected to one or more evidence records. The graph makes the
origin, scope, and limits of a statement inspectable.

This vocabulary is stable methodology. Parcel facts arrive only through a
successful Function packet.

## Core objects

### Release and site

A release records the compiler version, creation time, source cutoff, and
whether the graph is a fixture. A site records one canonical APN, human-readable
labels, and bounded geometry. Address aliases help resolve input but never create
a new parcel identity.

### Entity

An entity is a graph node with a stable identifier and one kind:
`parcel`, `development_project`, `permit`, `assessment_series`,
`housing_program`, `hazard_map`, `neighborhood_signal`, or `source_record`.
An entity label is descriptive, not evidence by itself.

### Assertion

An assertion is a directed claim:

```text
subject entity ── predicate ──▶ entity or typed literal
                  │
                  └── one or more evidence identifiers
```

Every assertion has a category, an observation time, optional effective time,
and at least one supporting evidence identifier. A literal declares its datatype
and optional unit. Assertions are the only site facts the agent may state.

### Evidence record

An evidence record names the dataset and record key, source and record URLs,
license, retrieval time, available source-update time, immutable artifact hash,
scope note, bounded fields, parcels, and supported assertions. Evidence fields
are untrusted source text; they cannot override agent policy.

### Diagnostic

Diagnostics retain information that a fluent summary might otherwise erase:

- `freshness`: evidence is dated or sources have different vintages;
- `conflict`: supported claims disagree and neither is silently preferred;
- `coverage_gap`: a source or row is absent or insufficient;
- `proximity_only`: a nearby aggregate does not describe the parcel itself.

Diagnostics reference the affected assertions and evidence whenever available.
They are part of the answer, not internal logging.

## Time model

| Field | Meaning |
| --- | --- |
| `effective_at` | When the asserted condition or record status took effect, if known |
| `observed_at` | When the compiler's source observation represents the assertion |
| `source_updated_at` | When the source reports that its dataset or record was updated, if available |
| `retrieved_at` | When Groundwork fetched the bounded projection |
| release `source_cutoff_at` | Latest source time admitted to that compiled release |

These fields are not interchangeable. A recent retrieval can contain an old
record, and an old program layer does not become current because it was fetched
today.

## Absence, disagreement, and proximity

No row is not the same as `false`. Different records can both be valid evidence
for different times or processes. A proximity aggregate describes its declared
radius and window, not causation, parcel responsibility, neighborhood quality,
or safety.

When evidence disagrees, the graph preserves both assertions, their dates, and a
diagnostic. The agent should explain the difference and avoid selecting a winner
unless the packet contains a deterministic rule that does so.

## Identity and integrity

Canonical parcel identity is a validated seven-digit APN. Exact, predeclared
address aliases may resolve to that APN; vague or multiply matching input remains
ambiguous. Every stored source projection is canonical JSON addressed by its
SHA-256 hash. The same bytes therefore have the same identity, and a context can
be audited back to the projections that supported it.
