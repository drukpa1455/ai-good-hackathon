# Judge-Ready SF Context Graph Implementation Plan

Status: Ready for approval

Repository: `drukpa1455/ai-good-hackathon`

Canonical path: `docs/implementation-plan.md`

Repository revision: `e7d145bc682e2989e0e8623b97e455ce507f5ef1`

Source inputs:

- `docs/frontend-design-handoff.md` at repository revision
  `e7d145bc682e2989e0e8623b97e455ce507f5ef1`
- `/Users/drk/Downloads/SF Community Site Context Graph.zip`, SHA-256
  `99a17227667755b2d814af8803c0b088f78ff2fb982fa986d619fd9a310217f8`
- the DigitalOcean AI event guide supplied in the project conversation
- official DigitalOcean references listed below, checked 2026-07-11

## Destination

The repository is documentation-only today. The supplied archive contains a
substantial React/Vite implementation with three deterministic site fixtures,
the frozen `ContextClient`, Cytoscape graph, MapLibre map, evidence drawer,
trust views, mock/HTTP modes, generated-widget boundary, and tests. In a
disposable checkout:

- Vite serves the app and its routes.
- The desktop and mobile shells render.
- The reference prototype is visually strong.
- The React graph is materially too small and crowded compared with the
  prototype.
- The archive does not pass its own lint, typecheck, unit-test, or build gates
  without narrow import hardening.
- The archive has no lockfile or explicit license.

Within eight working hours, deliver a public, judge-ready product at an exact
DigitalOcean App Platform revision:

1. The supplied React product runs in API mode with three honest demo sites,
   deterministic context graphs, evidence records, diagnostics, and deep links.
2. A DigitalOcean generated chat widget streams from a real Agent Platform
   agent using `glm-5.2`.
3. The agent calls a real secure DigitalOcean Function before answering any
   site-specific question.
4. The Function retrieves a bounded graph context packet from the deployed
   application and returns it to the model.
5. Every site claim can be traced to an evidence record and source URL; stale
   data, conflicts, coverage gaps, and demo-data status remain visible.
6. Desktop and mobile smoke tests, a tool-call trace, deployed Git SHA, resource
   inventory, screenshots, and a rehearsed 90-second path prove the result.

The product is useful because community housing organizations can inspect the
public-record context around a site without treating an AI answer as an
authority. The AI interprets a question, selects a site and focus, retrieves the
relevant graph, and explains it in plain language with citations and explicit
uncertainty. It does not create the facts, score neighborhoods, value property,
or make legal, safety, suitability, or investment decisions.

## Invariants and exclusions

- The public frontend contract in `docs/frontend-design-handoff.md` remains
  stable: five focus values, four `ContextClient` methods, four public API
  routes, graph/evidence shapes, and mock/API mode.
- Components receive product data only through `ContextClient`.
- The DigitalOcean widget owns chat rendering, streaming, history, feedback,
  and transport. This repository does not build a chat framework.
- `glm-5.2` is the sole generative model. There is no Anthropic model, model
  fallback, or LLM judge.
- All DigitalOcean components claimed in the demo are real. A component that is
  not ready is disabled and omitted from the narrative, never simulated.
- Demo graph facts have one canonical JSON release. The frontend mock client,
  HTTP API, graph packet, and tests consume that release or a deterministic
  derivation of it.
- While fixture-backed, `release.mock=true` and the visible demo-data badge
  remain. Fixture data is never relabeled as live official data.
- Every assertion resolves to at least one evidence record. Evidence IDs,
  record URLs, observation times, source times, licenses, and limitations
  survive every retrieval path.
- Runtime requests never call DataSF. No secret, raw private payload, credential,
  model key, Function password, or chat transcript enters Git.
- The browser receives only public widget identifiers and styling.
- Retries are bounded and used only for idempotent reads or known-safe creates.
  An unknown cloud-write result triggers inventory readback, not a blind retry.
- No custom chat UI, Vercel AI SDK, PydanticAI, LangChain, LlamaIndex, Neo4j,
  general graph query language, natural-language SQL, or custom model router is
  introduced.
- PostgreSQL, PostGIS, pgvector, a generic DataSF compiler, historical artifact
  retention, RDF/JSON-LD/SHACL/SPARQL, and exhaustive evaluation are outside the
  eight-hour critical path.
- The prototype HTML, support runtime, prototype fixtures, CARTO integration,
  and unlicensed mark/glyph libraries do not ship. Only the archive's `web/`
  tree is an import source.
- Naming and the small inline CSS/SVG wordmark are reversible presentation
  choices, not a permanent brand claim.
- Cloud provisioning, paid inference, public-agent visibility, and teardown are
  controlled actions. Before the first write, the operator records the exact
  Git SHA, resource names, region, spend ceiling, public window, and teardown
  deadline. One operator owns all writes.

## Decision

Build the smallest complete vertical slice around two stable seams:

1. `ContextRepository` owns graph-release reads.
2. `AgentContextProvider` owns question-aware graph retrieval and packet
   rendering.

Implement a validated `JsonReleaseRepository` and deterministic
`FullGraphContextProvider` first. Serve the built React app and FastAPI API
from one App Platform container. Add one secure Function as the Agent
Platform-compatible scalar adapter. Configure one `glm-5.2` Agent and use its
generated widget.

This makes the judge-visible DigitalOcean path real while mocking the
time-consuming part at the right boundary: acquisition and compilation of a
city-wide graph. Later repositories and retrievers replace the implementations
without changing the frontend, public API, Function schema, or agent prompt.

Use a small DigitalOcean Knowledge Base only as an isolated parallel enhancement
for official methodology, definitions, dataset descriptions, and licenses. It
may attach directly to the agent because it contains no site facts. The graph
Function remains mandatory for site answers. If ingestion or retrieval is not
verified by hour 6.5, leave the Knowledge Base detached and make no managed-RAG
claim.

Reject these alternatives for the first release:

- **Full DataSF compiler now:** too many source-specific parsers, temporal and
  spatial joins, data-quality decisions, and repair paths before any judge can
  use the product.
- **Managed PostgreSQL/PostGIS/pgvector now:** valuable later, but not visible
  enough to justify database provisioning, migrations, load/parity testing, and
  retrieval tuning before the product and Agent loop work.
- **A property-graph database:** DigitalOcean has no managed property-graph
  product; a self-managed database adds a second truth store and operational
  surface.
- **Function-owned fixtures:** duplicates graph truth between App Platform and
  Functions.
- **Agent-owned Knowledge Base facts:** obscures evidence identity and weakens
  deterministic graph constraints.
- **Prototype as production:** visually stronger in places, but it is an
  exported design runtime with console errors, prohibited dependencies, and
  unclear asset licensing rather than a maintainable application.

## Architecture

### Ownership and dependency direction

```text
                         stable public contracts
                                  |
                                  v
+----------------+    +------------------------+    +---------------------+
| React views    | -> | ContextClient          | -> | HTTP API            |
| no data I/O    |    | browser data boundary  |    | transport owner     |
+----------------+    +------------------------+    +----------+----------+
                                                             |
                                                             v
                                                  +----------------------+
                                                  | ContextRepository    |
                                                  | graph read owner     |
                                                  +----------+-----------+
                                                             |
                                                             v
                                                  +----------------------+
                                                  | canonical release    |
                                                  | immutable JSON       |
                                                  +----------------------+

Agent Platform -> Function adapter -> protected agent endpoint
                                      |
                                      v
                            AgentContextProvider
                                      |
                                      v
                             ContextRepository

Lower layers never import React, HTTP handlers, Agent Platform types, or cloud
configuration. Cloud adapters translate at the edges; graph behavior remains
pure and testable.
```

### Whole system

```text
+-------------------------------- PUBLIC BROWSER -------------------------------+
|                                                                               |
|  +--------------------------- React SPA -----------------------------------+  |
|  | site rail | map | context graph | evidence | trust | suggested prompts |  |
|  |                                                                         |  |
|  | ContextClient -------------------- GET /api/* ----------------------+    |  |
|  +--------------------------------------------------------------------|----+  |
|                                                                       |       |
|  +---------------- DigitalOcean generated widget ------------------+  |       |
|  | launcher | streaming | transcript | feedback | chat transport   |  |       |
|  +----------------------------+-------------------------------------+  |       |
+-------------------------------|----------------------------------------|-------+
                                |                                        |
                                v                                        v
                    +-------------------------+             +---------------------+
                    | Agent Platform          |             | App Platform        |
                    | model: glm-5.2          |             | one container       |
                    | public only for demo    |             | React dist + FastAPI|
                    +-----------+-------------+             +-----+----------+----+
                                |                                 |          |
                     mandatory tool call                           |          |
                                v                                 |          |
                    +-------------------------+                    |          |
                    | secure DO Function      |                    |          |
                    | scalar adapter only     |                    |          |
                    +-----------+-------------+                    |          |
                                |                                  |          |
                                | Bearer + HTTPS                    |          |
                                +--------------------------------->| /internal|
                                                                   | /agent/  |
                                                                   | context  |
                                                                   +----+-----+
                                                                        |
                                                                        v
                                                            +---------------------+
                                                            | FullGraphContext    |
                                                            | Provider            |
                                                            +----------+----------+
                                                                       |
                                                                       v
                                                            +---------------------+
                                                            | JsonReleaseRepo     |
                                                            | validated at start  |
                                                            +----------+----------+
                                                                       |
                                                                       v
                                                            +---------------------+
                                                            | demo release JSON   |
                                                            | one source of truth |
                                                            +---------------------+

Optional, isolated, and real when enabled:

  official methodology docs -> DO Knowledge Base -> agent retrieval

The Knowledge Base never stores site assertions or replaces the Function.
```

### Browser and frontend

```text
                           VITE_DATA_MODE
                                 |
                        selected once at boot
                                 |
                 +---------------+----------------+
                 |                                |
                 v                                v
       +--------------------+           +--------------------+
       | MockContextClient  |           | HttpContextClient  |
       | demo/test states   |           | production path    |
       +---------+----------+           +----------+---------+
                 |                                 |
                 +---------------+-----------------+
                                 |
                                 v
                       +--------------------+
                       | ContextClient      |
                       +---------+----------+
                                 |
       +-------------+-----------+-----------+-------------+
       |             |                       |             |
       v             v                       v             v
     routes         map                  graph/evidence   trust

Runtime widget config:

  GET /api/runtime-config
       |
       +-- disabled/incomplete --> non-blocking "Agent unavailable" card
       |
       +-- complete -----------> inject generated DO script exactly once

The main explorer remains complete if chat is disabled or unavailable.
```

### Canonical demo release

```text
data/releases/demo-v1/
  manifest.json
  sites.json
  contexts/
    3956008.json
    3501006.json
    0161014.json

             application start
                    |
                    v
          validate all JSON shapes
                    |
          +---------+----------+
          |                    |
       invalid              valid
          |                    |
          v                    v
   fail health/start     build immutable indexes
                         site_id -> ContextGraph
                         evidence_id -> EvidenceRecord
                                |
                  +-------------+-------------+
                  |                           |
           public API reads          agent packet reads
```

The release is source-controlled, immutable per release ID, and visible in
`/healthz`. Updates create a new release directory and change one configured
active release; in-place mutation is prohibited. Startup validation rejects
missing evidence references, duplicate IDs, unsupported schema versions,
invalid focus categories, or a manifest hash mismatch.

### Public and protected interfaces

```text
GET /healthz
  -> {status, git_sha, graph_release_id, data_mode}

GET /api/runtime-config
  -> PublicRuntimeConfig

GET /api/sites
  -> SiteSummary[]

GET /api/sites/{parcel_id}/context?focus={focus}
  -> ContextGraph

GET /api/evidence/{evidence_id}
  -> EvidenceRecord

POST /internal/agent/context
Authorization: Bearer <FUNCTION_TO_APP_TOKEN>
Content-Type: application/json

{
  "site": "3956008",
  "focus": "overview",
  "question": "What changed and what remains uncertain?"
}

-> {
  "context_packet": "<bounded deterministic text>",
  "graph_release_id": "demo-v1",
  "mock": true,
  "packet_sha256": "<sha256>"
}
```

Unknown IDs return the frozen `ApiError` shape with a request ID. Invalid
focus returns `invalid_focus`. The protected endpoint rejects missing or
incorrect credentials, normalizes address/APN aliases, caps each scalar input,
and returns `context_too_large` rather than truncating evidence invisibly.
Packets are at most 64 KiB and sorted by stable IDs.

### Agent and GraphRAG sequence

```text
User             Widget          GLM Agent        DO Function       App backend
 |                  |                 |                  |               |
 | site question    |                 |                  |               |
 |----------------->| chat request    |                  |               |
 |                  |---------------->|                  |               |
 |                  |                 | parse site/focus |               |
 |                  |                 | tool(site,focus,question)         |
 |                  |                 |----------------->|               |
 |                  |                 |                  | Bearer POST   |
 |                  |                 |                  |-------------->|
 |                  |                 |                  |               | load graph
 |                  |                 |                  |               | filter focus
 |                  |                 |                  |               | render packet
 |                  |                 |                  |<--------------|
 |                  |                 |<-----------------| scalar result |
 |                  |                 | synthesize only from packet      |
 |                  |                 | cite packet URLs; expose gaps     |
 |                  |<----------------| streamed answer                  |
 |<-----------------|                 |                  |               |

For general methodology questions only:

  GLM Agent -> optional Knowledge Base -> official methodology passage

For site-specific questions the graph Function is mandatory even when the
Knowledge Base is attached.
```

The AI owns language understanding, tool selection, and explanation. Stable
code owns graph filtering, evidence identity, dates, diagnostics, packet size,
and refusal boundaries. A tool trace with `include_functions_info=true` is
required demo evidence.

### DigitalOcean deployment topology

```text
DigitalOcean project: <approved exact project>
region:               <resolved supported common region>

+-------------------------------+
| App Platform                 |
| one basic service            |
| 0.0.0.0:$PORT / port 8080    |
| health: /healthz             |
| deploy_on_push: false        |
+---------------+--------------+
                |
                | public HTTPS
                v
       generated app domain
                ^
                | protected HTTPS
+---------------+--------------+
| Functions namespace          |
| context/get_site_context     |
| Python 3.13, 256 MiB, 10 sec |
+---------------+--------------+
                ^
                | secure function route
+---------------+--------------+
| Agent Platform               |
| exact live model UUID for    |
| model slug glm-5.2           |
| generated widget             |
+------------------------------+

Optional:
  one Knowledge Base containing methodology-only documents
```

Provisioning order is App -> Function -> private Agent -> Function route ->
private smoke -> public Agent/widget -> App runtime-config update -> public
smoke. The first App deploy has chat disabled because widget IDs do not exist
yet. Public runtime config avoids rebuilding frontend assets for widget IDs,
but App environment/config still receives the identifiers and triggers a
bounded second deployment.

### Failure and degradation

```text
Failure                            Product behavior
---------------------------------  ---------------------------------------------
Map tiles fail                     neutral map + parcel geometry + attribution
Public API fails                   typed error with retry/request ID
Unknown site/evidence              stable not-found state
Agent config incomplete            explorer works; chat unavailable card
Widget script fails                explorer works; chat failure card
Function/backend timeout           agent states retrieval failed; no fact answer
Graph packet too large             explicit error; never silent truncation
Knowledge Base unavailable         graph answers work; no methodology-RAG claim
Provider terms/model unavailable   agent stays private/disabled
Unknown cloud create result        inventory readback before any retry
Revision drift                     stop; do not deploy moving trunk
```

### No-rework evolution

```text
NOW                         NEXT                         PRODUCTIZED

demo release JSON  ----->   compiled release JSON ----> PostgresContextRepository
      |                            |                            |
JsonReleaseRepository      same repository contract      parity-tested swap

FullGraphContextProvider -> deterministic graph rank -> GraphRagContextProvider
      |                            |                            |
same Function schema       optional embeddings          pgvector + methodology KB

React / ContextClient / public API / Function / Agent tool contract:
UNCHANGED THROUGH THE MIGRATION
```

A future DataSF compiler owns acquisition, normalization, spatial joins,
temporal semantics, artifact hashes, and release publication. It emits the same
validated release shape first. PostgreSQL is introduced only after JSON/API
parity tests exist. pgvector is a rebuildable retrieval projection; canonical
entities, assertions, and evidence remain the truth.

### Parallel delivery graph

```text
             Plan and contract freeze
                       |
                       v
             Frontend foundation import
                       |
             verified foundation commit
                       |
        +--------------+----------------+
        |                               |
        v                               v
  UI critical fixes              Backend + release API
  graph scale/mobile             repository/provider/tests
        |                               |
        +--------------+----------------+
                       |
                       v
             Container integration
                       |
        +--------------+----------------+
        |                               |
        v                               v
  DO config + Function           API-mode Playwright
  agent prompt/schemas           desktop/mobile
        |                               |
        +--------------+----------------+
                       |
                       v
              exact revision freeze
                       |
                 cloud-write gate
                       |
                       v
      App -> Function -> Agent -> widget
                       |
           +-----------+-----------+
           |                       |
           v                       v
      smoke/rehearse       optional methodology KB
           |                       |
           +-----------+-----------+
                       |
                       v
                 feature freeze
```

The frontend foundation is the only serial prerequisite. After that commit,
separate worktrees can own UI, backend/data, and DigitalOcean configuration in
parallel. Root owns contract arbitration, integration, the exact deployable
revision, and every cloud write.

## Delivery

### Stage 1: Verified frontend foundation

- Entry evidence:
  - archive SHA-256 and safe tree audit recorded above;
  - disposable Vite screenshots exist for desktop and mobile;
  - baseline failures are reproducible.
- Plan-invalidating assumption:
  - the user-supplied `web/` code is authorized for this public repository;
  - its frozen contract is compatible with the design handoff.
- Ordered implementation units:
  1. Import only `design_handoff_groundwork_sf/web/**` into `web/**`.
  2. Generate and commit `package-lock.json`; pin the supported Node major for
     local and container builds to Node 22.
  3. Repair the incomplete handoff toolchain without redesigning the app:
     Node typings, ESM-safe e2e path, React Hooks lint configuration, unused
     import, and jsdom storage boundary.
  4. Preserve all seven mock states and three demo sites.
- Stage-wide acceptance and verification:

  ```bash
  npm --prefix web ci
  npm --prefix web run lint
  npm --prefix web run typecheck
  npm --prefix web test -- --run
  npm --prefix web run build
  npm --prefix web run e2e -- --project=desktop
  npm --prefix web run e2e -- --project=mobile
  ```

  Every command exits zero. Screenshots show the same product hierarchy and no
  browser error other than an explicitly triaged non-product asset request.
- Stage exit evidence:
  - one focused frontend-foundation PR with fresh command output and screenshots.
- Rollback and repair:
  - revert the import PR; the documentation-only repository remains intact.

### Stage 2: Local production vertical slice

- Entry evidence:
  - Stage 1 landed;
  - frontend contracts and fixture values are frozen.
- Plan-invalidating assumption:
  - one FastAPI container can serve both the SPA fallback and bounded API within
    App Platform limits.
- Ordered implementation units:
  1. Move fixture facts into the canonical `data/releases/demo-v1` release and
     keep mock-client imports deterministic.
  2. Add matching Pydantic transport/domain models.
  3. Implement `JsonReleaseRepository`, focus filtering, evidence index,
     validation, and `FullGraphContextProvider`.
  4. Implement `/healthz`, the four public endpoints, and protected agent
     context endpoint.
  5. Build React and FastAPI into one production container on port 8080 with
     SPA fallback.
  6. Make Playwright's base URL and web-server startup explicit environment
     controls, then run the same story against the already-running API-mode
     container.
  7. In parallel, repair only two judge-visible design problems: graph
     scale/overlap and mobile top-bar overflow. Do not port the prototype.
- Stage-wide acceptance and verification:

  ```bash
  uv sync --project backend --frozen
  uv run --project backend ruff check backend
  uv run --project backend pytest
  npm --prefix web ci
  npm --prefix web run lint
  npm --prefix web run typecheck
  npm --prefix web test -- --run
  npm --prefix web run build
  docker build --tag groundwork-sf:local .
  docker run --detach --publish 8080:8080 --name groundwork-sf-local groundwork-sf:local
  curl --fail --silent http://127.0.0.1:8080/healthz
  curl --fail --silent http://127.0.0.1:8080/api/sites
  PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 PLAYWRIGHT_SKIP_WEBSERVER=1 npm --prefix web run e2e -- --project=desktop
  PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 PLAYWRIGHT_SKIP_WEBSERVER=1 npm --prefix web run e2e -- --project=mobile
  docker rm --force groundwork-sf-local
  ```

  The container command is run in a managed background session and stopped
  after verification. Tests assert all five focuses, all three sites, evidence
  referential integrity, stable packet hashes, auth rejection, deep-link SPA
  fallback, and `release.mock=true`.
- Stage exit evidence:
  - exact local image digest;
  - zero-exit backend/frontend suites;
  - API-mode desktop/mobile screenshots.
- Rollback and repair:
  - disable API build mode and serve the Stage 1 mock frontend; data remains
    explicitly labeled as mock.

### Stage 3: Bounded DigitalOcean demo lease

- Entry evidence:
  - Stage 2 landed on canonical trunk;
  - exact Git SHA and clean-tree readback;
  - App Platform GitHub App access, provider terms, `glm-5.2` model UUID,
    common region, project ID, and operator authentication verified read-only;
  - user approval records exact resource names, spend ceiling, public interval,
    and teardown deadline.
- Plan-invalidating assumption:
  - `glm-5.2`, Agent Platform, Functions, and App Platform are available in a
    compatible region and the repository is authorized for App Platform.
- Ordered implementation units:
  1. Land `Dockerfile`, `.do/app.yaml`, `functions/project.yml`, Function
     handler, agent instructions, Function schemas, smoke prompts, and teardown
     checklist. The App spec uses one `apps-s-1vcpu-0.5gb` service, health
     check `/healthz`, port 8080, and `deploy_on_push: false`.
  2. Create the App with `deploy_on_push: false` and chat disabled.
  3. Create/deploy one secure Function namespace/function.
  4. Create one private `glm-5.2` agent using the live model UUID.
  5. Attach the Function route using scalar `site`, `focus`, and `question`
     fields and a string `context_packet` result.
  6. Pass private factual, uncertainty, citation, and refusal probes with
     `include_functions_info=true`.
  7. Make the Agent public for the approved window, restrict widget origins to
     the generated App domain, read exact widget identifiers, update runtime
     config, and deploy the same approved revision.
  8. Run public desktop/mobile smoke, inventory, health, revision, and cost
     readback.
  9. Optionally create and attach the methodology-only Knowledge Base if its
     isolated verification finishes before the cut line.
- Stage-wide acceptance and verification:

  ```bash
  test -z "$(git status --short)"
  test "$(git rev-parse HEAD)" = "$APPROVED_GIT_SHA"
  doctl apps list
  doctl serverless namespaces list
  doctl gradient list-models
  doctl gradient agent get "$AGENT_ID"
  curl --fail --silent "$APP_URL/healthz"
  curl --fail --silent "$APP_URL/api/sites"
  ```

  The non-secret shell values above come from the approved live resource
  ledger; secrets remain in ignored files or process environment. The health
  response SHA equals the approved Git SHA. A real agent response
  contains a Function trace, only packet source URLs, mock disclosure, and
  correct refusal behavior. The widget loads only on the allowed App domain.
- Stage exit evidence:
  - URL, Git SHA, image/deployment IDs, resource IDs, function trace, fixed
    prompt results, screenshots, and inventory/cost readback;
  - judge-window teardown remains scheduled rather than prematurely completed.
- Rollback and repair:
  - if Agent verification fails, keep it private and disable runtime widget
    config; the evidence explorer remains live;
  - if the deployed SHA is unhealthy, roll back to the prior known deployment
    or keep the App private; never chase moving trunk;
  - on unknown create/delete success, inventory first;
  - teardown in reverse dependency order: public visibility/widget, Agent,
    Knowledge Base if any, Function namespace, App; read inventory and billing
    before revoking the operator token.

### Eight-hour clock and cut lines

```text
0:00-0:30  persist plan; import verified frontend foundation
0:30-1:30  harden frontend; freeze contracts and canonical fixtures
1:30-3:30  backend/API/container and critical UI fixes in parallel
3:30-4:15  API-mode integration, desktop/mobile tests, exact revision freeze
4:15-5:15  App Platform then secure Function
5:15-6:30  private glm-5.2 Agent, function route, grounded smoke
6:30-7:00  public widget integration; optional methodology KB in parallel
7:00-7:30  feature freeze, public smoke, screenshots, inventory/cost readback
7:30-8:00  90-second rehearsal and judge handoff
```

- By hour 1: if visual changes threaten the build, ship the React baseline and
  escalate only the graph-scale defect to the design agent.
- By hour 3: if release relocation slips, serve the original immutable fixture
  paths through `JsonReleaseRepository`; do not duplicate or fabricate data.
- By hour 4: if semantic retrieval or PostgreSQL is proposed, defer it. Neither
  may delay the local container.
- By hour 5.5: if App/Function provisioning fails, preserve the local and
  container evidence, fix only the deployment blocker, and keep the Agent
  disabled.
- By hour 6.5: if private Agent tool use fails, do not make the Agent public.
- By hour 6.5: if Knowledge Base ingestion is not verified, detach it and omit
  the managed-RAG claim.
- At hour 7: feature freeze. Only revision, deployment, grounding, security, or
  demo-path blockers may change.
- Never cut evidence referential integrity, demo labeling, secret isolation,
  mandatory graph tool use, allowed-domain restriction, exact deployed SHA,
  spend readback, or teardown ownership.

## Migration and operations

### Release lifecycle

```text
new release directory
       |
       v
schema + referential validation
       |
       v
deterministic manifest/hash
       |
       v
repository parity tests
       |
       v
build/deploy exact revision
       |
       v
health reports active release
```

The demo release is durable in Git and visible through its release ID and hash.
It is consistent because startup either loads the entire validated release or
fails; there is no partial publication. It becomes stale only by an explicit
source cutoff recorded in the release. Repair is a new release, never mutation.

### Runtime bounds

- Public API reads are memory-bounded by the three-site release.
- Agent inputs have explicit length limits; packets are deterministic and at
  most 64 KiB.
- Function timeout is 10 seconds; its downstream App request budget is 5
  seconds, leaving time for response translation.
- The Function does not retry the protected POST. The Agent can invite the user
  to retry after an explicit retrieval failure.
- App service runs one small instance for the judge window; no autoscaling is
  required for the bounded demo.
- Public Agent visibility is time-bounded. Widget allowed domains contain only
  the exact generated App domain.
- Inference auto-reload remains off. The approved prepaid balance and resource
  ledger are the spend ceiling; the operator reads cost/inventory at each gate.
- Logs contain request IDs, durations, status, release ID, and packet hash, not
  secrets, payload bodies, or transcripts.

### Controlled cloud gate

No cloud write occurs until a revision-bounded ledger has all fields:

```text
approved_git_sha
digitalocean_project_id
region
app_name
function_namespace_name
function_name
agent_name
resolved_glm_5_2_model_uuid
optional_knowledge_base_name
prepaid_inference_limit
total_demo_spend_ceiling
public_agent_start
public_agent_end
teardown_deadline
operator
```

The operator is the sole cloud writer. Other agents may prepare configuration
and perform approved read-only verification. Production drift invalidates the
approval; the operator reports it instead of silently deploying a new revision.

## References

- Repository revision:
  `e7d145bc682e2989e0e8623b97e455ce507f5ef1`
- Frontend archive:
  `SF Community Site Context Graph.zip`,
  SHA-256 `99a17227667755b2d814af8803c0b088f78ff2fb982fa986d619fd9a310217f8`
- [DigitalOcean App Platform](https://docs.digitalocean.com/products/app-platform/)
- [DigitalOcean Functions](https://docs.digitalocean.com/products/functions/)
- [DigitalOcean GenAI Platform](https://docs.digitalocean.com/products/genai-platform/)
- [DigitalOcean Inference](https://docs.digitalocean.com/products/inference/)
- [DigitalOcean Knowledge Bases](https://docs.digitalocean.com/products/genai-platform/concepts/knowledge-bases/)
- [DigitalOcean doctl](https://docs.digitalocean.com/reference/doctl/)
- [DataSF](https://datasf.org/)
- [AI for Social Good hackathon](https://ai-for-social-good-mlh.devpost.com/)

## Open decisions

None.
