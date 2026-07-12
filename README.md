# AI for Good Hackathon

Public concept and build workspace for **AI for Social Good: Hack with MLH & DigitalOcean**, listed on the [Major League Hacking 2027 season schedule](https://www.mlh.com/seasons/2027/events) for July 10–11, 2026 in San Francisco.

## Status

Groundwork SF was deployed on DigitalOcean for the hackathon and was torn down
after the demonstration on July 11, 2026. No public App or Agent is currently
running. The repository preserves the tested application, deterministic demo
release, cloud configuration, and deployment runbook; the Hackathon Studio
handoff defines the durable static archive.

The current lead is an independently branded San Francisco community site
context graph. Deterministic code owns graph facts, evidence identity, dates,
and limits; the DigitalOcean agent architecture explains a bounded graph packet
without becoming the source of facts or making legal, safety, valuation, or
buy/sell claims.

See the [current architecture](docs/architecture.md) for the implemented system,
[deck alignment review](docs/deck-review.md) for presentation corrections,
[ideas.md](ideas.md) for the original shortlist, [resources.md](resources.md) for
links collected at the kickoff, and the
[frontend design handoff](docs/frontend-design-handoff.md) for the product
contract. The [Devpost submission](docs/devpost.md) preserves the public project
story and demo script. The
[Hackathon Studio handoff](docs/hackathon-showcase-design-handoff.md) and its
[copy-paste design-agent prompt](docs/hackathon-studio-design-agent-prompt.md)
define the publication-safe project archive, interactive mock app, HTML
presentation, and writing index.

## Local demo

The frontend requires Node 22; the API requires Python 3.13 through `uv`.

```bash
npm --prefix web ci
uv sync --project backend --frozen
VITE_DATA_MODE=api npm --prefix web run build
GIT_SHA=local FUNCTION_TO_APP_TOKEN=local-only-token \
  uv run --project backend uvicorn groundwork.api:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000`. The public API has four stable routes:
`/api/runtime-config`, `/api/sites`, `/api/sites/{parcel_id}/context`, and
`/api/evidence/{evidence_id}`. The protected agent route is
`POST /internal/agent/context` with a separate Function-to-app bearer token.

Run the local gates with:

```bash
uv run --project backend ruff check backend
uv run --project backend pytest
uv run --project backend ruff check functions
python3 -m unittest discover -s functions/tests
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web test -- --run
npm --prefix web run e2e
```

## Live DataSF context plane

Live refresh is an opt-in backend mode. `LIVE_DATA_ENABLED=false` is the exact
rollback: all existing routes continue to serve the verified fixture release.
When enabled, the API reads and refreshes bounded DataSF graphs through Managed
PostgreSQL and stores immutable source projections in a private Space.

Apply the tracked PostgreSQL migration before enabling live mode:

```bash
DATABASE_URL="postgresql://..." uv run --project backend python -m groundwork.migrate
```

The runtime then requires `DATABASE_URL`, `SPACES_ENDPOINT_URL`,
`SPACES_REGION`, `SPACES_BUCKET`, `SPACES_KEY`, and `SPACES_SECRET`.
`DATASF_APP_TOKEN` is optional. Secrets belong in App Platform encrypted
environment variables, never in Git. `GET /api/data-status` reports the three
featured parcels as fixture, live, stale, or refreshing without exposing source
payloads or credentials.

Real adapter probes are opt-in. `TEST_DATABASE_URL` enables the PostgreSQL
migration, fenced-lease, restart, evidence-readback, and retention integration
test. The default suite uses deterministic in-memory fakes and makes no cloud
writes.

## Candidate Public Sources

San Francisco sources under consideration:

- [Assessor Historical Secured Property Tax Rolls](https://data.sfgov.org/Housing-and-Buildings/Assessor-Historical-Secured-Property-Tax-Rolls/wv5m-vpq2/about_data)
- [Building Permits](https://data.sfgov.org/Housing-and-Buildings/Building-Permits/i98e-djp9/about_data)
- [San Francisco Development Pipeline](https://data.sfgov.org/Housing-and-Buildings/San-Francisco-Development-Pipeline/6jgi-cpb4/about_data)
- [Parcels — Active and Retired](https://data.sfgov.org/Geographic-Locations-and-Boundaries/Parcels-Active-and-Retired/acdm-wktn/about_data)
- [Affordable Housing Bonus Program eligible parcels](https://data.sfgov.org/d/fizh-zaxt)
- [100-Year Storm Flood Risk Zone](https://data.sfgov.org/d/jzu3-4yxp)
- [311 Cases](https://data.sfgov.org/City-Infrastructure/311-Cases/vw6y-z8j6/about_data)

Candidate 3D sources:

- [2023 USGS LiDAR: San Francisco](https://www.fisheries.noaa.gov/inport/item/73386), distributed through USGS and documented by NOAA
- [San Francisco 3D Buildings](https://www.arcgis.com/home/item.html?id=d3344ba99c3f4efaa909ccfbcc052ed5), an Esri scene layer credited to Precision Light Works
- [Google Photorealistic 3D Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles)
- [Aerometrex San Francisco 2 cm model](https://aerometrex.com/models/san-francisco-3d-model-2cm/)

## DigitalOcean deployment

The implemented DigitalOcean stack is:

1. a React/FastAPI image on [App Platform](https://docs.digitalocean.com/products/app-platform/)
2. Managed PostgreSQL for durable current graph snapshots
3. private Spaces buckets for content-addressed source projections and
   methodology documents
4. a secure Function that retrieves one bounded, hash-verified graph packet
5. a `glm-5.2` Agent Platform agent and generated streaming widget
6. a methodology-only Knowledge Base backed by Managed OpenSearch for the
   evaluated replacement agent

Deterministic code remains the fact owner. Live DataSF acquisition, durable
storage, Function retrieval, and model explanation stay separated behind the
same public API and agent-tool contracts. `LIVE_DATA_ENABLED=false` is the
exact rollback to the verified fixture release.

The tracked [App Platform baseline](.do/app.yaml), [secure Function](functions/),
and [approval-bounded demo lease](ops/digitalocean-demo-lease.md) describe the
reproducible configuration and own current live-state and teardown claims.

No paid API, cloud resource, or deployment is authorized merely by its mention here.

## Attribution and Data Boundaries

Major League Hacking and DigitalOcean names and marks belong to their respective owners. This independent participant repository is not an official event repository.

No third-party dataset, imagery, point cloud, or 3D payload is currently vendored here. Links do not grant redistribution rights. Before any source is copied, transformed, or published, its current license, attribution, access, privacy, and derived-work terms must be recorded and followed. In particular, the Esri scene layer requires Precision Light Works credit and Esri terms; Google tiles require a billing-enabled API key, displayed attribution, and compliance with Google Maps Platform terms; Aerometrex data is commercial.

Do not commit credentials, private records, provider payloads, or downloaded source data. Use bounded public projections and tracked provenance only.

## License

No project license has been selected yet. A software and content license will be chosen before a code release.
