# Groundwork SF — frontend (`web/`)

Judge-ready frontend for the SF Community Site Context Graph, built against
deterministic mock data per `docs/frontend-design-handoff.md`. Visual system:
the Spatioterra brand kits (dark default, light toggle), Inconsolata +
Atkinson Hyperlegible Mono.

## Demo (mock mode)

Requires Node 22 and an installed Google Chrome. The Playwright projects use
Chrome at desktop and mobile viewports, so no separate browser bundle is
downloaded.

```bash
npm --prefix web ci
VITE_DATA_MODE=mock npm --prefix web run dev
# open http://localhost:5173/  → redirects to /sites/3956008
```

Deterministic UI states (select once per page load):

```
/sites/3956008?mockState=ready|loading|empty|error|stale|conflict|chat-offline
```

Deep links: `/sites/:parcelId?focus=housing`, `/evidence/:evidenceId`.

## Verification

```bash
npm --prefix web ci
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web test -- --run
npm --prefix web run build
npm --prefix web run e2e     # also writes screenshots to tmp/frontend-handoff/
```

## Boundaries kept

- All data access goes through `ContextClient` (`src/data/client.ts`); the
  mock/HTTP choice happens once from `VITE_DATA_MODE`. Components never import
  fixtures or inspect the mode; only `mock-client.ts` reads `?mockState=`.
- `src/contracts.ts` owns the frozen public types plus their boundary-validation
  helpers. Backend integration preserves these shapes.
- Graph edges derive from entity-object assertions — no duplicate edges array.
- The map tile endpoint lives in one module: `src/map/tiles.ts` (official OSM
  raster endpoint + required attribution; tiles-failed fallback keeps the
  parcel on a neutral canvas).
- `AgentWidget.tsx` only injects DigitalOcean's generated widget script from
  runtime config. No custom chat transport, transcript, composer, or proxy.
- No DataSF calls, no source-join logic, no legal/safety/valuation/suitability
  conclusions. Mock releases always render the `MOCK DATA` badge.

## Backend integration

1. Implement the four `ContextClient` routes without changing component props.
2. Run the suites once with `VITE_DATA_MODE=mock` and once with `api`.
3. Keep mock mode for deterministic tests and design review.

For the API-mode browser suite, build the frontend with
`VITE_DATA_MODE=api`, start the FastAPI service on port 8000, then run:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8000 \
PLAYWRIGHT_SKIP_WEBSERVER=1 \
PLAYWRIGHT_DATA_MODE=api \
npm --prefix web run e2e
```
