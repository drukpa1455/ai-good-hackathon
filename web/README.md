# Groundwork SF frontend

The archived React interface for the SF Community Site Context Graph. Every
site, graph, map, evidence, and runtime request crosses one `ContextClient`
boundary, backed by deterministic fixtures or the FastAPI service.

## Run locally

Use Node 22 and Google Chrome:

```bash
npm --prefix web ci
VITE_DATA_MODE=mock npm --prefix web run dev
```

Open <http://localhost:5173/sites/3956008>.

Mock states are selected once per page load:

```text
/sites/3956008?mockState=ready|loading|empty|error|stale|conflict|chat-offline
```

Deep links use `/sites/:parcelId?focus=housing` and
`/evidence/:evidenceId`.

## Verify

```bash
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web test -- --run
npm --prefix web run build
npm --prefix web run e2e
```

Playwright writes disposable review images under `tmp/frontend-handoff/`.

## Boundaries

- `src/data/` chooses mock or HTTP transport once. Components never import
  fixtures, call DataSF, or inspect provider credentials.
- `src/contracts.ts` and the backend contracts remain compatible. Graph edges
  derive from entity-object assertions; there is no duplicate edge store.
- `src/map/tiles.ts` owns theme-aware raster sources, attribution, and the
  neutral-canvas failure path.
- `AgentWidget.tsx` injects DigitalOcean's generated widget. The provider owns
  chat rendering and transport; Groundwork owns only configuration, bounded
  loading, origin checks, and layout.
- Mock releases always show `MOCK DATA`. The interface makes no legal, safety,
  valuation, or suitability conclusions.

## API-mode browser suite

Build the frontend with `VITE_DATA_MODE=api`, start FastAPI on port 8000, then
run:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8000 \
PLAYWRIGHT_SKIP_WEBSERVER=1 \
PLAYWRIGHT_DATA_MODE=api \
npm --prefix web run e2e
```
