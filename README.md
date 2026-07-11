# AI for Good Hackathon

Public concept and build workspace for **AI for Social Good: Hack with MLH & DigitalOcean**, listed on the [Major League Hacking 2027 season schedule](https://www.mlh.com/seasons/2027/events) for July 10–11, 2026 in San Francisco.

## Status

The local demo is runnable. It serves three explicitly labeled deterministic
site-context fixtures through a React evidence explorer and a FastAPI API. The
demo is not yet deployed and no DigitalOcean resource has been provisioned.

The current lead is an independently branded San Francisco community site
context graph. Deterministic code owns graph facts, evidence identity, dates,
and limits; a DigitalOcean agent will explain a bounded graph packet without
becoming the source of facts or making legal, safety, valuation, or buy/sell
claims.

See [ideas.md](ideas.md) for the current shortlist and go/no-go criteria, [resources.md](resources.md) for links collected at the kickoff, and the [frontend design handoff](docs/frontend-design-handoff.md) for the mock-first UI contract.

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

## Platform direction

The judge-ready DigitalOcean path is:

1. deploy this single React/FastAPI image through [DigitalOcean App Platform](https://docs.digitalocean.com/products/app-platform/)
2. create a secure DigitalOcean Function that requests a bounded graph packet
3. connect a `glm-5.2` Agent Platform agent to that Function
4. embed DigitalOcean's generated streaming widget using runtime configuration
5. optionally attach a methodology-only Knowledge Base after the critical demo path is verified

The fixture release is the current source of truth. A DataSF compiler,
PostgreSQL/PostGIS/pgvector, and broader managed RAG are productization steps
behind the stable public API and agent-tool contracts, not prerequisites for
the first demo.

The tracked [App Platform baseline](.do/app.yaml), [secure Function](functions/),
and [approval-bounded demo lease](ops/digitalocean-demo-lease.md) are ready for
the next deployment phase. They create no cloud resources by themselves.

No paid API, cloud resource, or deployment is authorized merely by its mention here.

## Attribution and Data Boundaries

Major League Hacking and DigitalOcean names and marks belong to their respective owners. This independent participant repository is not an official event repository.

No third-party dataset, imagery, point cloud, or 3D payload is currently vendored here. Links do not grant redistribution rights. Before any source is copied, transformed, or published, its current license, attribution, access, privacy, and derived-work terms must be recorded and followed. In particular, the Esri scene layer requires Precision Light Works credit and Esri terms; Google tiles require a billing-enabled API key, displayed attribution, and compliance with Google Maps Platform terms; Aerometrex data is commercial.

Do not commit credentials, private records, provider payloads, or downloaded source data. Use bounded public projections and tracked provenance only.

## License

No project license has been selected yet. A software and content license will be chosen before a code release.
