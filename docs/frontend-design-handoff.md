# Frontend Design Handoff: SF Community Site Context Graph

Status: Ready for frontend implementation

Audience: Design/frontend agent working independently from the backend and
data-graph work

## Mission

Build the complete judge-facing frontend against deterministic mock data. The
result must be polished enough to demo before the real API, PostgreSQL graph,
DigitalOcean Knowledge Base, or agent exists.

The experience helps community land trusts, affordable-housing organizations,
and neighborhood nonprofits understand the official public-record context around
a San Francisco site. It is an evidence explorer, not a real-estate marketplace,
ranking product, valuation tool, or recommendation engine.

The frontend should make one idea immediately legible:

> Every visible claim is part of a source-backed context graph, and uncertainty
> stays visible.

## Ownership Boundary

The frontend agent owns everything under `web/`:

- visual system and responsive layout
- map, graph, evidence, and trust interactions
- frontend routing and URL-deep-link behavior
- mock client and fixtures
- loading, empty, stale, conflict, error, and chat-unavailable states
- frontend accessibility, tests, and build configuration
- loading the DigitalOcean-generated chatbot widget from runtime configuration

The frontend agent does not own:

- DataSF queries or source normalization
- graph identity, joins, conflict detection, freshness calculation, or trust
  calculation
- PostgreSQL, PostGIS, Spaces, Knowledge Base, Functions, or Agent provisioning
- arbitrary graph traversal or natural-language-to-SQL
- a custom chatbot, streaming transport, message store, or agent loop
- legal, safety, valuation, suitability, or buy/sell conclusions
- a final product name, logo, or association with another product

All frontend data access must pass through one `ContextClient` interface.
Mock-versus-HTTP behavior belongs at that boundary; components must not contain
`mock` conditionals or call DataSF directly.

## Demo Story

The designed 90-second flow is:

1. Open on **300 De Haro Street** with its parcel highlighted.
2. Animate the context graph outward from parcel to project, permit, assessor
   history, public programs, hazard-map evidence, and nearby civic reports.
3. Select the “425 affordable units” assertion.
4. Open its evidence drawer and show the official dataset, record key,
   observation date, and source link.
5. Switch to **758/772 Pacific Avenue** and expose the historical AHBP warning.
6. Show the trust panel: citation coverage, stale sources, conflicts, coverage
   gaps, and graph release.
7. Point to the DigitalOcean chatbot and its suggested question: “What changed
   at 300 De Haro, and what remains uncertain?”
8. Finish on the evaluation summary, clearly labeled as the latest fixed
   evaluation—not a live agent trace.

The map, graph, evidence drawer, and trust panel must remain impressive and
useful when chat is disabled.

## Information Architecture

### Desktop

Use a full-height application shell:

- **Top bar:** descriptive project title, active graph release, data timestamp,
  and a compact “How this works” entry.
- **Site rail:** three story cards with address, project type, current
  public-record status, and one headline housing figure.
- **Map pane:** parcel geometry, site marker, small source attribution, and
  focus controls.
- **Graph pane:** the primary visual surface; selected parcel at the center with
  evidence-backed assertions expanding around it.
- **Evidence drawer:** opens from the right or bottom without losing map/graph
  context.
- **Trust strip/panel:** persistent summary with expandable diagnostics.
- **Agent area:** reserve the bottom-right corner for DigitalOcean’s floating
  widget and place suggested questions nearby without imitating the widget.

The graph should receive more visual weight than the map. The product is a
context graph with a spatial entry point, not a map with a decorative network.

### Mobile

- Compact top bar and site selector
- Tabs for `Graph`, `Map`, and `Evidence`
- Trust summary directly below the selected site
- Full-screen evidence sheet
- Graph remains pan/zoom capable with large tap targets
- No content or controls may sit behind the chatbot launcher

Target viewports for acceptance are `1440x900` and `390x844`.

## Visual Direction

The visual language should feel civic, optimistic, precise, and alive—not
financial, luxury-real-estate, governmental-portal, or generic AI-gradient.

Recommended characteristics:

- warm off-white or deep ink canvas with high-contrast civic colors
- one consistent color per entity kind
- thin evidence lines that strengthen on selection
- subtle depth and motion for graph expansion
- compact source/date typography that still meets readability requirements
- explicit warning treatment for stale, conflicting, missing, and proximity-only
  evidence
- no red/green-only status encoding
- reduced-motion mode that removes graph transitions without reducing
  information

Entity colors must be defined once as design tokens for:

- parcel
- development project
- permit
- assessor history
- housing program
- hazard map
- neighborhood signal
- source record

## Routes

The frontend owns these routes:

- `/` redirects to the default site.
- `/sites/:parcelId` opens a site and preserves the selected focus in the query
  string.
- `/evidence/:evidenceId` opens the corresponding site with its evidence drawer
  selected.

Unknown site and evidence IDs render a useful not-found state and a link back to
the three demo sites. Route refreshes must work when FastAPI supplies the SPA
fallback.

## Interaction Model

`App.tsx` owns exactly four pieces of navigation state:

- selected parcel ID
- selected focus
- selected entity/assertion ID
- selected evidence ID

Expected interactions:

- Selecting a site updates the URL, map, graph, evidence, trust panel, and
  suggested questions.
- Selecting a map parcel selects the corresponding graph entity.
- Selecting a graph node highlights its geometry and related assertions.
- Selecting a literal assertion opens the first supporting evidence record.
- Selecting an evidence link opens the drawer and updates the URL.
- Opening `/evidence/:evidenceId` resolves the site from
  `EvidenceRecord.parcel_ids`, then loads that site's context before opening the
  drawer.
- Changing focus filters the current context; it does not fetch an unrelated
  graph.
- The browser back button restores site/evidence selection.
- Escape closes drawers; focus returns to the initiating control.

Allowed focus values:

- `overview`
- `housing`
- `permits`
- `hazards`
- `neighborhood`

The graph layout is deterministic. Use parcel-centered concentric or
breadth-first placement with stable entity-kind ordering. Do not use a fresh
random force layout on every render.

## Frontend File Shape

The design agent should create the smallest coherent structure below:

```text
web/
  e2e/demo.spec.ts
  index.html
  package.json
  package-lock.json
  playwright.config.ts
  tsconfig.json
  vite.config.ts
  vitest.config.ts
  src/
    App.tsx
    main.tsx
    styles.css
    contracts.ts
    data/
      client.ts
      http-client.ts
      mock-client.ts
    mocks/
      sites.json
      context-3956008.json
      context-3501006.json
      context-0161014.json
      runtime-config.json
    components/
      AppShell.tsx
      SiteSelector.tsx
      ParcelMap.tsx
      ContextGraph.tsx
      EvidenceDrawer.tsx
      TrustPanel.tsx
      FocusControl.tsx
      SuggestedQuestions.tsx
      AgentWidget.tsx
      MockDataBadge.tsx
```

Use React, React Router, TypeScript, Vite, MapLibre GL JS, Cytoscape.js, plain
CSS design tokens, Vitest, Testing Library, and Playwright. Do not add Tailwind,
shadcn/ui, TanStack Query, a state-management library, or a component framework
unless the existing design cannot be expressed clearly without it.

## Frozen Frontend Contract

Implement these types in `web/src/contracts.ts`. They are the parallel-work
contract for the backend. OpenAPI-generated types will replace this file during
integration without changing `ContextClient` or component props.

```ts
export type ContextFocus =
  "overview" | "housing" | "permits" | "hazards" | "neighborhood";

export type EntityKind =
  | "parcel"
  | "development_project"
  | "permit"
  | "assessment_series"
  | "housing_program"
  | "hazard_map"
  | "neighborhood_signal"
  | "source_record";

export type DiagnosticKind =
  "freshness" | "conflict" | "coverage_gap" | "proximity_only";

export interface Point {
  longitude: number;
  latitude: number;
}

export type Position = [longitude: number, latitude: number];

export type GeoJsonGeometry =
  | { type: "Point"; coordinates: Position }
  | { type: "Polygon"; coordinates: Position[][] }
  | { type: "MultiPolygon"; coordinates: Position[][][] };

export interface ReleaseSummary {
  id: string;
  created_at: string;
  source_cutoff_at: string;
  compiler_version: string;
  mock: boolean;
}

export interface SiteSummary {
  parcel_id: string;
  name: string;
  address: string;
  subtitle: string;
  story: string;
  centroid: Point;
  geometry: GeoJsonGeometry;
  headline: {
    label: string;
    value: string;
  };
}

export interface Entity {
  id: string;
  kind: EntityKind;
  label: string;
  description: string | null;
  geometry: GeoJsonGeometry | null;
  source_count: number;
}

export type AssertionObject =
  | { kind: "entity"; entity_id: string }
  | {
      kind: "literal";
      value: string | number | boolean;
      datatype:
        "string" | "integer" | "decimal" | "boolean" | "date" | "datetime";
      unit: string | null;
    };

export interface Assertion {
  id: string;
  subject_id: string;
  predicate: string;
  predicate_label: string;
  category: ContextFocus | "identity";
  object: AssertionObject;
  effective_at: string | null;
  observed_at: string;
  evidence_ids: string[];
}

export interface EvidenceRecord {
  id: string;
  dataset_id: string;
  dataset_name: string;
  title: string;
  record_key: string;
  source_url: string;
  record_url: string | null;
  license_id: string;
  retrieved_at: string;
  source_updated_at: string | null;
  artifact_sha256: string;
  scope_note: string | null;
  parcel_ids: string[];
  assertion_ids: string[];
  fields: Record<string, string | number | boolean | null>;
}

export interface Diagnostic {
  id: string;
  kind: DiagnosticKind;
  severity: "info" | "warning";
  title: string;
  detail: string;
  assertion_ids: string[];
  evidence_ids: string[];
}

export interface AgentEvaluationSummary {
  status: "passed" | "failed" | "not_run";
  evaluated_at: string | null;
  graph_release_id: string | null;
  agent_config_sha256: string | null;
  passed_cases: number;
  total_cases: number;
}

export interface TrustSummary {
  graph_release_id: string;
  source_count: number;
  assertion_count: number;
  citation_coverage_percent: number;
  freshness_warning_count: number;
  conflict_count: number;
  coverage_gap_count: number;
  proximity_only_count: number;
  latest_agent_evaluation: AgentEvaluationSummary;
}

export interface ContextGraph {
  schema_version: "1.0";
  release: ReleaseSummary;
  site: SiteSummary;
  focus: ContextFocus;
  entities: Entity[];
  assertions: Assertion[];
  evidence: EvidenceRecord[];
  diagnostics: Diagnostic[];
  trust: TrustSummary;
}

export interface PublicRuntimeConfig {
  data_mode: "mock" | "api";
  agent: {
    enabled: boolean;
    script_url: string | null;
    agent_id: string | null;
    chatbot_id: string | null;
    name: string;
    starting_message: string;
    primary_color: string;
    secondary_color: string;
    button_background_color: string;
  };
}

export interface ApiError {
  code: "not_found" | "invalid_focus" | "context_too_large" | "unavailable";
  message: string;
  request_id: string;
}
```

The frontend derives graph edges from assertions whose object is an entity. It
must not require a duplicate `edges` array.

## `ContextClient` Contract

```ts
export interface ContextClient {
  getRuntimeConfig(): Promise<PublicRuntimeConfig>;
  listSites(): Promise<SiteSummary[]>;
  getContext(parcelId: string, focus: ContextFocus): Promise<ContextGraph>;
  getEvidence(evidenceId: string): Promise<EvidenceRecord>;
}
```

`mock-client.ts` and `http-client.ts` implement the same interface. `client.ts`
selects one implementation once from `VITE_DATA_MODE`; components never inspect
that environment variable.

The future HTTP mapping is:

| Client method      | Endpoint                                          |
| ------------------ | ------------------------------------------------- |
| `getRuntimeConfig` | `GET /api/runtime-config`                         |
| `listSites`        | `GET /api/sites`                                  |
| `getContext`       | `GET /api/sites/{parcelId}/context?focus={focus}` |
| `getEvidence`      | `GET /api/evidence/{evidenceId}`                  |

## Mock Fixture Requirements

Mock fixtures are normalized, contract-shaped design data. They are not official
records and must never be described as a completed source graph.

Use:

```json
{
  "id": "mock-release-0001",
  "created_at": "2026-07-10T12:00:00-07:00",
  "source_cutoff_at": "2026-07-10T12:00:00-07:00",
  "compiler_version": "mock",
  "mock": true
}
```

When `release.mock` is true, render a persistent but unobtrusive `MOCK DATA`
badge. Production API mode must never display it.

### Site fixture headlines

- `3956008` — 300 De Haro Street; centroid `(-122.402024, 37.765725)`; headline
  `425 affordable units`; status `Construction`.
- `3501006` — 1939 Market Street; centroid `(-122.425311, 37.769934)`; headline
  `185 affordable units`; status `BP Issued`.
- `0161014` — 758/772 Pacific Avenue; centroid `(-122.407850, 37.796978)`;
  headline `174 affordable units`; status `BP Filed`.

Use a small rectangular mock polygon around each centroid rather than copying an
official parcel geometry into the design fixture. The real API will replace it.

### Minimum graph for each fixture

Each site context contains 6–10 entities:

- selected parcel
- development project
- at least one permit
- grouped assessor-history series
- applicable or evaluated housing-program layer
- evaluated July 2022 flood-map layer
- one aggregated nearby-311 signal
- source-record nodes only when the current focus benefits from them

Each site contains:

- at least one entity-to-entity assertion
- at least three literal assertions
- at least four evidence records
- one freshness diagnostic
- one coverage-gap or proximity-only diagnostic

Specific mock stories:

- **300 De Haro:** proposed units `425`, affordable units `425`, status
  `Construction`, zoning `UMU`, permit number `202107235031`, AHBP exact-query
  coverage gap.
- **1939 Market:** proposed units `187`, affordable units `185`, status
  `BP Issued`, affordable senior-housing description, AHBP exact-query coverage
  gap.
- **758/772 Pacific:** proposed units `175`, affordable units `174`, status
  `BP Filed`, affordable senior-housing description, historical 2015 AHBP match
  and freshness warning.

Use stable evidence IDs such as:

- `ev-acdm-wktn-3956008`
- `ev-6jgi-cpb4-3956008`
- `ev-i98e-djp9-mock-record-3956008-1`
- `ev-wv5m-vpq2-3956008-series`

Do not fabricate a current flood-risk conclusion. The mock graph may show that
the parcel was evaluated against the July 2022 layer and that the source is
stale; an `intersects` assertion belongs only in the backend result.

### Mock states

`mock-client.ts` supports deterministic states selected once from `?mockState=`:

- `ready`
- `loading`
- `empty`
- `error`
- `stale`
- `conflict`
- `chat-offline`

The `conflict` state adds two incompatible, same-effective-time mock assertions
and a diagnostic linking both. The `empty` state means no context for a valid
site, not an empty site list. Tests must cover every state.

## Map Contract

- Render parcel geometry from `SiteSummary.geometry`.
- Use MapLibre with the official OpenStreetMap raster endpoint only for
  interactive, on-screen tiles.
- Keep visible `© OpenStreetMap contributors` attribution.
- Do not prefetch or offer offline tiles.
- Keep the tile source configurable in one module.
- When tiles fail, retain parcel geometry, controls, selection, and attribution
  on a neutral canvas.
- Fit bounds when a site changes; do not continuously recenter after user
  interaction.

## Graph Contract

- Cytoscape consumes `entities` plus entity-object `assertions`.
- Literal assertions appear as compact fact satellites or in the selected-entity
  inspector; they must remain selectable and citeable.
- Node size may encode degree, never social value, risk, desirability, or
  opportunity.
- Edge width may encode selection, never model confidence.
- Source count and freshness belong in labels/tooltips, not inferred opacity.
- A visual legend explains every entity kind and diagnostic treatment.
- Keep labels readable at the default demo zoom.

## Evidence Drawer

The evidence drawer must display:

- dataset name and ID
- evidence title and stable record key
- selected normalized fields
- source observation time
- source update time
- source scope note
- license ID
- shortened artifact hash with copy affordance
- official source link
- every assertion supported by that evidence record

Do not render arbitrary raw JSON by default. A compact “Fields used” table is
the primary view.

## Trust Panel

Display these as deterministic graph metrics:

- citation coverage
- source count
- assertion count
- freshness warnings
- conflicts
- coverage gaps
- proximity-only context
- graph release ID

The agent-evaluation section must say **Latest fixed agent evaluation** and show
its evaluation/config/release stamps. Never label this panel as a live retrieval
trace, live chain of thought, or current chatbot activity.

## DigitalOcean Chatbot Boundary

`AgentWidget.tsx` loads DigitalOcean’s generated widget script only when all
runtime fields are present and `agent.enabled` is true. The widget owns its
launcher, chat history, response rendering, transport, and feedback.

Frontend responsibilities are limited to:

- injecting the documented script and public `data-*` values once
- reserving layout space so the launcher covers nothing
- displaying suggested questions beside, but outside, the widget
- showing a non-blocking “Agent unavailable; explore the evidence graph” state
  when disabled or failed

Do not build a chat transcript, message composer, streaming parser, proxy
endpoint, or synchronized tool-trace panel.

Suggested questions:

- “What changed at 300 De Haro, and what remains uncertain?”
- “Which records support the affordable-unit count at 1939 Market?”
- “Which sources for 758 Pacific are historical or stale?”
- “What do nearby 311 reports tell us—and what do they not prove?”

## Accessibility Requirements

- WCAG AA contrast
- full keyboard operation
- visible focus indication
- semantic landmarks and headings
- graph nodes available through a parallel keyboard list or inspector
- map information duplicated textually
- minimum 44 px touch targets
- no status conveyed only by color, shape, motion, or position
- reduced-motion support
- drawer focus trap and focus restoration
- screen-reader announcement when site, focus, or evidence changes

## Acceptance Evidence

The frontend handoff is complete when:

- all three routes and sites work entirely in mock mode
- map, graph, evidence, trust, and URL selection stay synchronized
- every assertion resolves to existing mock evidence
- all seven mock states have intentional UI
- desktop and mobile screenshots show no overlap with the agent corner
- mock mode is visibly labeled
- chat-offline mode leaves the primary experience complete
- no component imports fixtures directly; only `mock-client.ts` does
- no frontend code calls DataSF or contains source-join logic
- no custom chat transport exists
- axe checks report no serious violations
- the production bundle builds without network credentials

Run:

```bash
npm --prefix web ci
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web test -- --run
npm --prefix web run build
npm --prefix web run e2e
```

## Backend Integration Handoff

When the backend OpenAPI document is ready:

1. Generate `web/src/contracts.generated.ts` with `openapi-typescript`.
2. Compare generated shapes with this frozen contract and resolve differences at
   the API boundary.
3. Change `ContextClient` imports to generated types without changing component
   props or state ownership.
4. Run the same component and Playwright suite once with `VITE_DATA_MODE=mock`
   and once with `VITE_DATA_MODE=api`.
5. Keep mock mode for deterministic tests and design review.
6. Remove the mock badge only in API mode; do not delete the fixtures.

The frontend agent should hand back:

- the complete `web/` implementation
- desktop and mobile screenshots under `tmp/frontend-handoff/`
- the exact mock-mode demo command
- a short list of any contract mismatch discovered
- no backend, data-source, cloud, or agent-platform changes

## Open Decisions

None. Visual copy, color values, spacing, typography, and motion curves are
frontend-owned reversible choices within this contract.
