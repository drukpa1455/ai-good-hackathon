# Groundwork SF

> Every public-record claim should carry its proof.

Groundwork SF is a proof-carrying civic context graph built in 24 hours for
**AI for Social Good: Hack with MLH & DigitalOcean** in San Francisco. It helps
community housing teams inspect what public records say about a site, which
source supports each claim, and what remains stale, conflicting, nearby, or
unknown.

[![Hackathon](https://img.shields.io/badge/MLH%20×%20DigitalOcean-AI%20for%20Social%20Good-5b4bc4)](https://ai-for-social-good-mlh.devpost.com/)
![Status](https://img.shields.io/badge/status-archived%20demo-6b7280)
![Python](https://img.shields.io/badge/Python-3.13-3776ab)
![Node](https://img.shields.io/badge/Node-22-339933)

![Final Groundwork SF interface design showing a parcel map, evidence graph, public-record entities, and deterministic trust diagnostics](docs/assets/groundwork-overview.png)

*Final interface design rendered from the canonical interactive prototype.*

## What we built in 24 hours

- A responsive React evidence explorer combining a parcel map, navigable graph,
  evidence drawer, and trust diagnostics.
- One typed graph contract for sites, entities, assertions, evidence, dates,
  diagnostics, and release identity.
- Bounded compilation from seven DataSF datasets into three featured site
  graphs, with deterministic fixtures as an exact fallback.
- Managed PostgreSQL snapshots with fenced refresh leases and atomic
  publication, plus content-addressed source projections in private Spaces.
- A secure DigitalOcean Function that gave a `glm-5.2` Agent one bounded,
  digest-verified graph packet per site question.
- A separate methodology Knowledge Base backed by Managed OpenSearch, plus a
  fixed 50-query evaluation corpus for grounding, citation, ambiguity,
  freshness, refusal, and prompt injection.
- A complete DigitalOcean deployment, live demonstration, verification, and
  teardown.

The application was deployed for the event and permanently torn down on
July 11, 2026. No public App, Agent, database, Function, or storage bucket is
currently running. Everything needed to inspect and run the deterministic demo
remains here.

## The product

Choose a site and Groundwork keeps four views synchronized:

1. **Map** — spatial entry point and parcel context.
2. **Graph** — projects, permits, assessor history, public programs, hazard
   layers, neighborhood signals, and their relationships.
3. **Evidence** — the exact dataset, record key, selected fields, dates,
   license, source URL, and projection digest behind a claim.
4. **Trust** — deterministic citation coverage, freshness warnings, conflicts,
   coverage gaps, and proximity-only evidence.

![Final Groundwork SF evidence-drawer design showing the source record, observed and source dates, selected fields, digest, and supported assertions](docs/assets/groundwork-evidence.png)

*Canonical evidence design; the typed contract owns the underlying semantics.*

An absent record never silently becomes a negative claim. A nearby event never
becomes a parcel fact. Historical, stale, conflicting, missing, and
proximity-only evidence remain distinct in both the contract and interface.

## Why the AI is bounded

The model is an explainer, not the fact authority:

```text
site question
    |
    v
DigitalOcean Agent
    |
    v
secure Function ----> protected FastAPI route
                           |
                           v
                 bounded graph packet
                 + URLs + dates + diagnostics
```

Deterministic code owns identity, joins, assertions, dates, limits, and
citations. For a site-specific answer, the Agent must retrieve a successful
packet, cite only URLs inside it, preserve its qualifications, and fail closed
when retrieval is unavailable. Stable methodology follows a separate RAG path
and cannot substitute for missing site evidence.

## Architecture

```text
                               DIGITALOCEAN

 Browser                 App Platform
 React + MapLibre   <-->  React/FastAPI image
 + Cytoscape                     |
       |                         +--> Managed PostgreSQL
       |                         |    snapshots + refresh leases
       |                         +--> private Spaces
       |                         |    source projections + RAG docs
       |                         +--> bounded DataSF queries
       |
       +--> generated widget --> GLM-5.2 Agent
                                      |
                          site facts  +--> secure Function
                                      |       |
                                      |       +--> graph packet
                                      |
                          methodology +--> Knowledge Base
                                              |
                                              +--> Managed OpenSearch
```

Each component has one job. PostgreSQL stores current graph state; Spaces
preserves immutable inputs; the Function constrains retrieval; the Agent
explains; the Knowledge Base supplies methodology; App Platform serves the
tested product revision.

See [architecture.md](docs/architecture.md) for component boundaries,
sequences, limits, durability, rollback, and failure behavior.

## Run the archived demo

The fastest path uses bundled, visibly labeled mock data and makes no
DigitalOcean or DataSF API calls:

```bash
npm --prefix web ci
VITE_DATA_MODE=mock npm --prefix web run dev -- --host 127.0.0.1
```

Open <http://127.0.0.1:5173/sites/3956008>.

To run the production-shaped React/FastAPI artifact with the verified fixture
release:

```bash
uv sync --project backend --frozen
VITE_DATA_MODE=api npm --prefix web run build
GIT_SHA=local \
FUNCTION_TO_APP_TOKEN=local-only-token \
LIVE_DATA_ENABLED=false \
uv run --project backend uvicorn groundwork.api:app \
  --host 127.0.0.1 --port 8000
```

Open <http://127.0.0.1:8000/sites/3956008>.

The public API exposes:

```text
GET  /api/runtime-config
GET  /api/sites
GET  /api/sites/{parcel_id}/context
GET  /api/evidence/{evidence_id}
GET  /api/data-status
```

`POST /internal/agent/context` is a separate protected Function-to-app
boundary. Credentials, private source payloads, and provider artifacts do not
belong in Git.

## Verification

The default suites use deterministic fakes and fixtures. Cloud integration and
live DataSF probes are opt-in.

```bash
uv run --project backend ruff check backend
uv run --project backend pytest
uv run --project backend ruff check functions
python3 -m unittest discover -s functions/tests
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web test -- --run
npm --prefix web run build
npm --prefix web run e2e
```

Run the frontend build and Playwright serially because both use `web/dist`.

## Public data

The demonstrated compiler uses bounded projections from:

- San Francisco Development Pipeline
- Building Permits
- Assessor Historical Secured Property Tax Rolls
- Parcels — Active and Retired
- Affordable Housing Bonus Program eligibility
- 100-Year Storm Flood Risk Zone
- 311 Cases

The repository contains hash-checked public demo projections, not private
records or unrestricted source dumps. Dataset scope and official links are
cataloged in [docs/sources.md](docs/sources.md).

## What we learned

- Provenance works best as a product primitive, not a footnote.
- `unknown`, `historical`, `stale`, and `nearby` are different states.
- Graph facts and methodology RAG need separate ownership.
- A smaller, inspectable retrieval surface makes an Agent more trustworthy.
- Stable mock/API contracts let frontend, data, and cloud work proceed in
  parallel without creating two products.
- Managed evaluation is a release gate, not a score to explain away: the
  replacement Agent remained unpromoted when its compact-answer configuration
  missed the fixed threshold.
- Public inference should have a short exposure window and an explicit teardown
  owner.

## Repository map

| Path | Responsibility |
| --- | --- |
| [`backend/src/groundwork/`](backend/src/groundwork/) | Graph contract, API, DataSF compiler, PostgreSQL, and Spaces boundaries |
| [`web/`](web/) | React product, mock/HTTP client boundary, graph, map, and evidence UI |
| [`functions/`](functions/) | Secure Function-to-app adapter |
| [`data/releases/demo-v1/`](data/releases/demo-v1/) | Hash-checked deterministic public release |
| [`rag/`](rag/) | Methodology-only Knowledge Base documents |
| [`evaluations/`](evaluations/) | Fixed Agent behavior corpus |
| [`.do/app.yaml`](.do/app.yaml) | Reproducible App Platform baseline |
| [`ops/digitalocean-demo-lease.md`](ops/digitalocean-demo-lease.md) | Deployment, verification, spend, exposure, and teardown contract |
| [`docs/devpost.md`](docs/devpost.md) | Submitted project story and demo script |
| [`docs/frontend-design-handoff.md`](docs/frontend-design-handoff.md) | Product, interaction, evidence, and visual contract |
| [`docs/writing/`](docs/writing/) | Public tutorial, case study, and focused follow-up proposals |
| [`docs/hackathon-studio-design-agent-prompt.md`](docs/hackathon-studio-design-agent-prompt.md) | Canonical static archive, app, presentation, and writing handoff |

## Technical writing

Read the public
[evidence-first Graph RAG tutorial](docs/writing/evidence-first-graph-rag-on-digitalocean.md),
the shorter [24-hour engineering case study](docs/writing/groundwork-digitalocean-case-study.md),
and the [code-backed roadmap for future DigitalOcean pieces](docs/writing/README.md).

## Project status

Groundwork SF is an archived hackathon build and teaching example. The former
cloud deployment is gone; the repository and deterministic demo remain active.
The technical writing is public. Any future DigitalOcean Community submission
must be a new, original manuscript rather than a copy of these repository
pieces.

The Devpost copy records what was demonstrated at submission time. Current
operational truth lives in this README and the teardown record in
[`ops/digitalocean-demo-lease.md`](ops/digitalocean-demo-lease.md).

## License and attribution

Original code and documentation are available under the [MIT License](LICENSE).
Third-party datasets, maps, names, and marks remain subject to their respective
licenses and terms. This independent participant project is not an official
MLH, DigitalOcean, or City and County of San Francisco repository.
