# Groundwork SF current architecture

This document describes the implemented hackathon system and owns its concise
technical map. The event deployment has been torn down. During any future
approved deployment, `/healthz` and `/api/data-status` are the authoritative
revision and data-state readbacks.

Presentation claims derived from this architecture are reconciled in the
[deck alignment review](deck-review.md).

## Architectural thesis

Groundwork has one fact authority: a deterministic, typed context graph. The
model can explain that graph, but it cannot create site facts, choose hidden
sources, or erase dates and limitations.

Three boundaries keep that rule enforceable:

1. The DataSF compiler turns bounded public records into the canonical graph.
2. The secure Function gives the Agent one bounded, hash-verified graph packet.
3. The Knowledge Base contains methodology only; it never substitutes for site
   evidence.

## Whole system

```text
                                           DIGITALOCEAN

  +-------------------+       HTTPS       +-----------------------------+
  | Browser           | <----------------> | App Platform                |
  | React + TypeScript|   public API/UI    | one React/FastAPI container |
  | MapLibre +        |                    +--------------+--------------+
  | Cytoscape         |                                   |
  +---------+---------+                 +-----------------+------------------+
            |                           |                 |                  |
            | generated widget          v                 v                  v
            |                 +------------------+ +---------------+ +---------------+
            |                 | Managed          | | private       | | DataSF SODA   |
            |                 | PostgreSQL 17    | | Spaces        | | seven bounded |
            |                 | graph snapshots  | | source JSON   | | projections   |
            |                 +------------------+ +---------------+ +---------------+
            |
            v
  +-------------------+     tool call      +-----------------------+
  | Agent Platform    | -----------------> | DigitalOcean Function |
  | GLM-5.2           |                    | get-site-context      |
  +---------+---------+                    +-----------+-----------+
            |                                          |
            | methodology retrieval                    | Bearer-authenticated
            v                                          | protected request
  +-------------------+                                v
  | Knowledge Base    |                      App Platform
  | Managed OpenSearch|                      /internal/agent/context
  +---------+---------+
            ^
            |
  +---------+---------+
  | private Spaces    |
  | methodology docs  |
  +-------------------+
```

The browser never receives a model key, Function credential, database URL, or
Spaces credential. It receives public API data and DigitalOcean-generated
widget identifiers only.

## Canonical graph model

The graph is an application contract, not a model-generated structure and not
a property-graph database.

```text
  Release
     |
     +-- Site (parcel identity, address, geometry)
     |     |
     |     +-- Entity ----------------------------------+
     |     |     kinds: parcel, project, permit,         |
     |     |     assessment, program, hazard, signal    |
     |     |                                             |
     |     +-- Assertion                                 |
     |           subject -- predicate --> entity/literal |
     |           effective_at + observed_at              |
     |           |                                       |
     |           +------------------+                    |
     |                              v                    |
     +-- EvidenceRecord <-------- evidence_ids ----------+
     |     dataset + record key + source URLs
     |     retrieved_at + source_updated_at + license
     |     canonical artifact SHA-256 + selected fields
     |
     +-- Diagnostic
     |     freshness | conflict | coverage_gap | proximity_only
     |     references affected assertions and evidence
     |
     +-- TrustSummary
           citation coverage + diagnostic counts
```

Every assertion must reference evidence. Missing DataSF rows become explicit
coverage gaps, spatially nearby records remain proximity-only signals, and
conflicting dated assertions coexist instead of being silently reconciled.

## Ownership

| Component | Owns | Does not own |
| --- | --- | --- |
| React frontend | Selection, graph/map/evidence presentation, deep links | Data acquisition, graph facts, model policy |
| FastAPI service | Public contracts, graph validation, live/fixture selection, protected packet rendering | Chat transport or free-form retrieval |
| DataSF compiler | Queries, normalization, typed assertions, evidence, diagnostics | Persistence or natural-language answers |
| Managed PostgreSQL | Durable snapshots, evidence rows, current pointers, refresh leases | Graph semantics |
| Artifact Space | Immutable canonical DataSF projections | Current-state selection |
| DigitalOcean Function | Scalar validation, protected request, response bounds, packet digest verification | Facts, prompt policy, retries |
| Public Agent | Current streamed chat and Function tool use | Direct database or DataSF access |
| Private replacement Agent | Function tool use plus methodology retrieval | Production traffic until evaluation passes |
| Knowledge Base and OpenSearch | Stable methodology retrieval | Site records or site-specific claims |

## Flow 1: browser read path

```text
Browser              App Platform          PostgreSQL / fixture
   |                        |                        |
   | GET /api/sites        |                        |
   |---------------------->| fixture site index     |
   |<----------------------|                        |
   |                        |                        |
   | GET /api/sites/{apn}/context?focus=...         |
   |---------------------->| get current snapshot   |
   |                        |----------------------->|
   |                        |<-----------------------|
   |<----------------------| typed ContextGraph     |
   |                        |                        |
   | GET /api/evidence/{id}| current evidence row   |
   |---------------------->|----------------------->|
   |<----------------------|<-----------------------|
```

The frontend has one `ContextClient` boundary. Components do not call DataSF,
inspect secrets, or fork mock and API semantics.

## Flow 2: live refresh and atomic publication

```text
Request      FastAPI        PostgreSQL        DataSF       Spaces
   |            |                |               |            |
   | context    |                |               |            |
   |----------->| current?       |               |            |
   |            |--------------->|               |            |
   |            | fresh: return  |               |            |
   |            |<---------------|               |            |
   |            |                |               |            |
   |            | stale/missing: acquire 20 s fenced lease   |
   |            |--------------->|               |            |
   |            | parcel query + six dependent bounded queries
   |            |-------------------------------->|            |
   |            |<--------------------------------|            |
   |            | compile and validate graph      |            |
   |            | canonicalize seven source projections       |
   |            |--------------------------------------------->|
   |            |<---------------------------------------------|
   |            | publish receipts + snapshot + evidence      |
   |            |--------------->|               |            |
   |            | atomically move current pointer |            |
   |            |<---------------|               |            |
   |<-----------| live graph     |               |            |
```

The first query resolves an active seven-digit parcel and centroid. Six
dependent queries fetch development pipeline, permits, assessments, affordable
housing program coverage, flood-layer intersection, and a bounded 311 count.
All selected fields and row limits are fixed in code.

Publication is transactional. A lease owner may publish only its parcel and
generation; a late worker cannot overwrite a newer refresh. PostgreSQL retains
the ten newest snapshots per parcel and removes unreferenced artifact receipts.
Spaces objects are content-addressed by dataset and SHA-256 and are verified
with object metadata after upload.

## Flow 3: Agent and graph-aware RAG

```text
User       DO widget       GLM-5.2 Agent       Function       FastAPI
 |             |                 |                 |              |
 | question    |                 |                 |              |
 |------------>| stream request  |                 |              |
 |             |---------------->|                 |              |
 |             |                 | site question?  |              |
 |             |                 | get-site-context|              |
 |             |                 |---------------->| validate     |
 |             |                 |                 |-------------->|
 |             |                 |                 | bounded graph |
 |             |                 |                 |<--------------|
 |             |                 |                 | verify SHA-256|
 |             |                 |<----------------|              |
 |             |                 | answer from packet only        |
 |             |<----------------|                                 |
 |<------------| streamed answer with packet URLs, dates, limits  |
```

This is graph-aware RAG with two non-overlapping retrieval planes:

- **Site-fact plane:** every site-specific answer requires the Function. The
  packet contains the focused graph, evidence URLs, dates, diagnostics, release
  state, and a digest. Function failure means no factual answer.
- **Methodology plane:** the private replacement Agent can retrieve graph
  semantics, dataset definitions, and responsible-use policy from its
  Knowledge Base. The Knowledge Base contains no featured-site facts.

The Agent does not query PostgreSQL, Spaces, or DataSF directly. Address aliases
are resolved against the three supported sites; vague street or neighborhood
names remain ambiguous. The prompt forbids valuation, legal, safety,
suitability, ranking, eligibility, and investment conclusions.

## Durability and consistency

| Data | Source | Durable representation | Visibility | Repair |
| --- | --- | --- | --- | --- |
| Fallback graph | Tracked demo release | Git JSON + SHA-256 manifest | Public | Rebuild from owning release sources |
| Live source projection | Bounded DataSF response | Private content-addressed Spaces object | Private | Refetch DataSF; identical bytes deduplicate |
| Live context graph | Deterministic compiler | PostgreSQL JSONB snapshot and evidence rows | Private service data | Run a new fenced refresh |
| Current graph | Latest accepted snapshot | PostgreSQL current pointer | Private service data | Atomic pointer advances only after full validation |
| Methodology | Tracked `rag/*.md` | Private methodology Space + Knowledge Base index | Agent retrieval only | Re-upload and reindex from tracked documents |
| Model answer | Agent inference | Streamed response, not graph truth | End user | Repeat retrieval against current packet |

## Bounds and security

- DataSF responses are capped at 1 MiB each, use four connections, and retry
  only once for `429` or `5xx` responses.
- One refresh has an eight-second outer timeout, four-way concurrency, a
  20-second lease, a 15-minute freshness TTL, and a 100-parcel store cap.
- The Agent packet is capped at 65,536 bytes. The Function allows only five
  focus values, makes one five-second request, rejects redirects, caps the
  response at 262,144 bytes, and verifies the packet SHA-256.
- App, database, Spaces, and Function credentials stay in encrypted runtime
  configuration. The Function-to-app Bearer value is distinct from the secure
  Function web credential.
- The public widget is restricted to the App domain. The browser receives no
  privileged credential.
- Agent responses are capped by the platform at 512 tokens; the tracked prompt
  therefore requires answer-first responses under 120 words.

## Failure behavior and rollback

| Condition | Deterministic behavior |
| --- | --- |
| Live mode disabled | Serve the verified fixture release through the same API |
| Fresh PostgreSQL snapshot | Serve it without a DataSF request |
| Stale snapshot and another refresh owns the lease | Serve the snapshot as `stale` |
| DataSF refresh fails with prior snapshot | Preserve and label the stale snapshot |
| No live snapshot but fixture exists | Serve the labeled fixture fallback |
| Invalid compiler output or lost lease | Do not publish |
| Live evidence store unavailable | Fail evidence reads instead of mixing live and fixture records |
| Function unavailable or packet invalid | Agent must not answer site facts |
| Candidate evaluation below gate | Keep replacement private and retain the working public Agent |

`LIVE_DATA_ENABLED=false` is the exact data-plane rollback. Agent promotion is
independent: the public widget changes only after private probes and the fixed
managed evaluation pass.

## DigitalOcean deployment topology

| Service | Current role |
| --- | --- |
| App Platform (`tor`) | One 0.5 GiB service running the static frontend and FastAPI API |
| Managed PostgreSQL 17 (`tor1`) | One 1 GiB node for durable graph snapshots and leases |
| Spaces (`tor1`) | Separate private artifact and methodology buckets |
| Functions (`tor1`) | Python 3.13 adapter, 256 MiB memory, 10-second platform timeout |
| Managed OpenSearch 2.19 (`tor1`) | One 2 GiB / 10 GiB node backing methodology retrieval |
| Knowledge Base (`tor1`) | Indexed methodology documents with retrieval rewriting |
| Agent Platform (`tor1`) | Public Function-backed GLM-5.2 Agent plus private evaluated replacement |
| Agent Evaluations | Fixed 50-query grounding, ambiguity, freshness, refusal, injection, and methodology gate |

The App and Managed PostgreSQL use a project VPC and private database binding.
App Platform secrets are encrypted at runtime. Resource identifiers and
credentials are intentionally omitted from public documentation.

## Stable interfaces

| Interface | Consumer | Contract |
| --- | --- | --- |
| `GET /healthz` | Deployment verification | App revision and bootable fallback release |
| `GET /api/runtime-config` | Browser | Public data mode and widget configuration only |
| `GET /api/sites` | Browser | Three featured site summaries |
| `GET /api/sites/{parcel_id}/context` | Browser | Focused typed graph with live/stale/fixture status |
| `GET /api/evidence/{evidence_id}` | Browser | Current evidence record |
| `GET /api/data-status` | Operators | Per-site live, stale, refreshing, or fixture state |
| `POST /internal/agent/context` | Function only | Bearer-protected bounded graph packet |

One subtle but important distinction: `/healthz` proves that the application
booted with a valid tracked fallback release. `/api/data-status` reports the
separate live-data plane. A healthy app can therefore truthfully serve a mix of
live and stale snapshots while retaining a validated fixture rollback.
