# Live Data and DigitalOcean Platform Plan

Status: **Ready for approval**

Repository: `drukpa1455/ai-good-hackathon`

Evidence revision: `f06844581d0173b8921181481c3a0fb7fe20275d`

Canonical path after approval: `docs/live-data-digitalocean-plan.md`

## Destination

```text
DataSF SODA APIs
    │ bounded HTTPS queries
    ▼
App Platform · live compiler
    ├── validates and normalizes records
    ├── constructs entities/assertions/evidence/diagnostics
    └── computes content hashes
          │
          ├── raw bounded projections → Spaces
          └── compiled ContextGraph → Managed PostgreSQL
                                      │
Browser/API ◀─────────────────────────┤
                                      │
GLM Agent → DigitalOcean Function ────┘

Methodology docs → Spaces → Knowledge Base/OpenSearch → GLM Agent
                                              │
                                   Agent Evaluations + observability
```

Each component earns its place:

- **App Platform:** frontend, API, source compiler and cache orchestration.
- **Managed PostgreSQL:** transactional current-context pointer, compiled graphs, evidence lookup, refresh leases and provenance metadata.
- **Spaces:** immutable, content-addressed DataSF response projections.
- **Functions:** authenticated tool boundary between the public agent and graph service.
- **Agent Platform:** GLM‑5.2 reasoning and generated streaming chat.
- **Knowledge Base/OpenSearch:** methodology and dataset definitions only—never site facts.
- **Agent Evaluations:** factual grounding, context adherence, safety and instruction-following evidence.

DigitalOcean documents Managed PostgreSQL integration with App Platform, S3-compatible Spaces, and Spaces-backed Knowledge Bases. ([PostgreSQL](https://docs.digitalocean.com/products/app-platform/how-to/manage-databases/), [Spaces](https://docs.digitalocean.com/products/spaces/reference/s3-compatibility/), [Knowledge Bases](https://docs.digitalocean.com/products/knowledge-bases/how-to/create/))

## Stage 0: Restore grounded demo-site conversations

One PR: `fix: resolve demo-site address variants`

- Deterministically map common variants to the three canonical APNs:
  - `300 Haro`, `300 De Haro` → `3956008`
  - `1939 Market` → `3501006`
  - `758 Pacific`, `772 Pacific`, `758/772 Pacific` → `0161014`
- Keep vague or ambiguous identifiers rejected.
- Give the Agent the canonical demo-site map.
- Permit exactly one `not_found` retry using the uniquely matched APN.
- Never claim a retry unless a second Function result exists.
- Reduce Agent temperature to `0.1`.
- Verify in a fresh conversation before promoting the configuration.

Acceptance:

- The reported `300 Haro` conversation succeeds with a Function trace.
- All supported variants return the same graph packet as their APN.
- Vague input such as `Pacific` remains `not_found`.
- Answers disclose fixture status and cite packet URLs.

## Stage 1: Real DataSF graph compiler

One PR: `feat: compile live datasf context graphs`

- Add a fixed registry for the seven dataset schemas and permitted fields.
- Query only validated seven-digit APNs; existing addresses remain aliases.
- Fetch at most seven bounded projections per refresh.
- Aggregate 311 server-side; never retrieve individual case notes or media.
- Compile `ContextGraph` with `mock=false`.
- Preserve actual retrieval time, source update time, query URL, license and artifact hash.
- Represent missing rows as coverage gaps.
- Represent old quarterly pipeline data versus newer permits as freshness evidence, not as silently resolved truth.
- Keep packet size under 65,536 bytes.

Existing [repository.py](/Users/drk/src/ai-good-hackathon/backend/src/groundwork/repository.py) remains the fallback release owner. Existing [agent_context.py](/Users/drk/src/ai-good-hackathon/backend/src/groundwork/agent_context.py) remains the packet-rendering boundary.

## Stage 2: Durable live context plane

One dependent PR: `feat: persist and serve live context snapshots`

Add:

- `DataSFClient`
- pure `DataSFCompiler`
- `ContextStore`
- `ArtifactStore`
- `LiveContextService`

Runtime behavior:

1. Serve a cached live graph when younger than 15 minutes.
2. Otherwise acquire a 20-second PostgreSQL refresh lease.
3. Fetch with a total eight-second deadline, four-request concurrency, and one bounded retry for idempotent `429`/`5xx`.
4. Upload canonical JSON to Spaces at `datasf/{dataset}/{sha256}.json`.
5. Commit artifacts, evidence and the new current-context pointer atomically.
6. On failure, serve the last live snapshot as stale.
7. Without a live snapshot, serve the current fixture with `mock=true`.

Public requests can refresh the three featured parcels. Arbitrary APNs can refresh only through the authenticated Function route. Storage is capped at 100 parcels and ten snapshots per parcel.

The four public API contracts remain compatible. A new read-only `/api/data-status` route reports refresh state without credentials or raw payloads.

## Stage 3: Provision and activate the data plane

Exact incremental resources:

- PostgreSQL `groundwork-sf-context`
  - PostgreSQL 17
  - `tor1`
  - one `db-s-1vcpu-1gb` node
- Private Space `groundwork-sf-artifacts-57a71ad0`
- Private Space `groundwork-sf-methodology-57a71ad0`
- One bucket-scoped App key
- Existing App and Function; no replacements

Deploy behind `LIVE_DATA_ENABLED=false`, migrate, then enable the same approved SHA and refresh the three sites. Rollback is one configuration change back to the immutable fixture repository.

## Stage 4: Complete the AI plane

One PR: `docs: add methodology rag and evaluation assets`

- Add methodology, source definitions, graph semantics and responsible-use documents.
- Add a 50-query evaluation CSV with `query` and `expected_response`.
- Create OpenSearch `groundwork-sf-kb-index`:
  - version 2.19
  - `tor1`
  - one `db-s-1vcpu-2gb-10gb` node
- Create Knowledge Base `groundwork-sf-methodology`
  - All MiniLM L6 v2
  - methodology Space only
- Create private Agent `groundwork-sf-live-agent`
  - GLM‑5.2
  - `tor1`
  - existing Function route
  - methodology Knowledge Base
- Run factual, freshness, ambiguity, refusal and injection probes.
- Run one managed 50-query evaluation.
- Promote the new widget only after probes and evaluation pass.
- Delete the old agent only after fresh production evidence.

DigitalOcean recommends 50–100 evaluation prompts and supports correctness, context quality, safety and instruction-following metrics. Evaluations use OpenAI as the external judge; GLM‑5.2 remains our product model. ([evaluation documentation](https://docs.digitalocean.com/products/inference/how-to/evaluate-agents/))

## Hard limits

- No UI files.
- No GPU, router, Kubernetes, pgvector, arbitrary graph query language or custom chat system.
- Maximum new resources: one PostgreSQL, one OpenSearch, two Spaces buckets, one Knowledge Base and one replacement Agent.
- Maximum plans: PostgreSQL $15/month, OpenSearch $19/month, Spaces $5/month, all prorated.
- Evaluation estimate must be at most $10.
- Total approved incremental charge/credit: **$15**.
- Teardown remains **July 12, 2026 at noon PDT**.
- Any larger plan, billing estimate, revision drift or unknown-success write stops execution.

## Verification

- All backend, Function and frontend gates pass.
- Live integration validates all seven DataSF schemas.
- `mock=false` and actual source hashes appear for all three sites.
- 758 Pacific visibly preserves the stale pipeline/newer permit distinction.
- Spaces object SHA matches each evidence artifact SHA.
- PostgreSQL current pointers and evidence lookups survive App restart.
- Forced DataSF failure serves stale live data; empty cache serves the labeled fixture.
- Function trace proves live graph retrieval.
- Knowledge Base answers methodology questions but never replaces Function facts.
- Agent evaluation produces a saved scorecard and cost report.
- Exact deployed Git SHA, resource inventory and rollback path are recorded.

Open decisions: **None**
