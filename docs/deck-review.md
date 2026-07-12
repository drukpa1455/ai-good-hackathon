# Groundwork deck alignment

This review compares `Groundwork Deck.pdf` with the implemented system and the
event DigitalOcean deployment, which has since been torn down. The deck is
visually strong: its hierarchy,
dark palette, diagrams, and product screenshots already feel presentation
ready. The highest-value work is correcting a few claims and making
DigitalOcean's role visible earlier and more precisely.

Runtime state can change. Before presenting, verify the approved revision with
`/healthz` and the three parcel states with `/api/data-status`; do not treat
this review as a live cloud ledger.

## Corrections required before presenting

| Slide | Current implication | Replace with |
| --- | --- | --- |
| 2–3 | The product exposes who owns a parcel or its ownership history. | The product exposes parcel context and **assessment or tax-roll history**. It does not publish owner identity. |
| 4 | A screenshot labeled `MOCK DATA` demonstrates the live system. | Capture the deployed API-mode product with a live or stale DataSF status. If the existing image remains, label it “deterministic fallback UI,” not “live interactive.” |
| 5 | Canonical release JSON is the normal data path, and the Knowledge Base combines site facts with graph retrieval. | Show PostgreSQL as the durable snapshot/current-pointer store, Spaces as immutable source evidence, and the tracked release only as fallback. Show site-fact retrieval through the Function separately from methodology retrieval through the private candidate Agent's Knowledge Base. |
| 8 | Managed PostgreSQL is merely a future path. | State that Managed PostgreSQL is in use for versioned snapshots, evidence rows, current pointers, and fenced refresh leases. Add Spaces, Managed OpenSearch, and Agent Evaluations to the DigitalOcean story. |
| 9 | Data refresh is nightly, pgvector powers graph retrieval, evaluations gate every data release, and `/healthz` reports the active live graph. | Refresh is request-driven with a 15-minute freshness window and a fenced lease. There is no pgvector path. Evaluations gate candidate **Agent promotion**. `/healthz` identifies the deployed app and boot fallback; `/api/data-status` reports live, stale, refreshing, or fixture state per parcel. |
| 10 | The public production Agent combines the Function and Knowledge Base, and every public answer exposes its tool trace. | The public Agent is Function-backed. A private replacement Agent adds methodology-only Knowledge Base retrieval and remains promotion-gated. Private probes and evaluations record Function traces; public answers carry packet citations, dates, status, and limits. |

## Recommended DigitalOcean throughline

Use the same sentence from the opening through the architecture slides:

> DigitalOcean runs Groundwork's complete proof path: deploy the product, store
> current graph state, preserve immutable source evidence, secure Agent access,
> retrieve methodology, stream explanations, and evaluate the next Agent before
> promotion.

This is stronger than counting products because each service owns a distinct
system invariant:

```text
App Platform        one deployed frontend/API revision
Managed PostgreSQL  atomic current graph + durable versioned snapshots
Spaces              immutable, content-addressed source projections
Functions           narrow authenticated Agent-to-evidence trust boundary
Agent Platform      GLM-5.2 explanation + generated streaming widget
Knowledge Base      methodology-only RAG for the private candidate Agent
Managed OpenSearch  managed retrieval index behind the Knowledge Base
Agent Evaluations   measured candidate-promotion gate
```

Add “Built end-to-end on DigitalOcean” to slide 1 or slide 3. By slide 5, show
the real managed data path rather than waiting until the sponsor section to
introduce DigitalOcean. Logos alone are not the proof; the ownership boundaries
above are.

## Replacement copy and diagrams

### Slide 5 — system architecture

Replace the release-centric diagram with the current two-plane design:

```text
LIVE EVIDENCE PLANE

DataSF --bounded queries--> deterministic graph compiler
                                      |
                         +------------+------------+
                         |                         |
                         v                         v
              Managed PostgreSQL           private Spaces
              snapshots + current          canonical source JSON
                         |
                         v
                 App Platform API <--> React explorer

AGENT PLANE

User --> DO streaming widget --> GLM-5.2 Agent
                                      |
                         site facts   +--> DO Function --> protected graph packet
                         methodology  +--> Knowledge Base --> Managed OpenSearch
                                              private candidate only
```

Caption: “Deterministic code owns facts. DigitalOcean owns the deployed,
durable, secured, and evaluated path from public record to explanation.”

### Slide 8 — why DigitalOcean

Keep the existing card treatment, but organize it around outcomes:

- **Ship:** App Platform deploys one tested React/FastAPI artifact.
- **Prove:** PostgreSQL stores current snapshots; Spaces preserves exact source
  inputs.
- **Protect:** Functions expose one bounded, authenticated, digest-verified
  graph packet to the Agent.
- **Explain:** Agent Platform runs GLM-5.2 and supplies the streaming widget.
- **Ground:** Knowledge Base and Managed OpenSearch retrieve methodology without
  becoming the site-fact authority.
- **Improve:** Agent Evaluations measure the private replacement before
  promotion.

If six cards are too dense, keep four outcome cards on slide 8 and put the full
topology on slide 9.

### Slide 9 — operational proof

Suggested title: **A live evidence system, not a static demo**.

```text
request
   |
   v
PostgreSQL current snapshot --fresh--> return graph
   |
 stale or missing
   v
20 s fenced lease --> 7 bounded DataSF projections --> validate typed graph
                                                    |
                         private Spaces <-----------+ source artifacts
                                                    |
                         PostgreSQL <---------------+ atomic publication
```

Use these proof points:

- request-driven refresh with a 15-minute freshness window;
- ten retained snapshots per parcel and an atomic current pointer;
- content-addressed, SHA-256-verified source artifacts in private Spaces;
- stale or fixture fallback is explicit rather than silently presented as live;
- `/healthz` identifies the deployed revision, while `/api/data-status` reports
  parcel-level data state.

Remove “nightly release,” “pgvector projections,” and “evaluations gate every
release.” They describe neither the current implementation nor the correct
ownership model.

### Slide 10 — Agent trust boundary

Suggested title: **The Agent can explain evidence; it cannot invent it**.

```text
site question --> Agent --> Function --> protected App route
                               |              |
                         validate inputs      +--> focused context graph
                         bound response       +--> official URLs + dates
                         verify SHA-256       +--> gaps + conflicts + status
```

Then distinguish current and candidate operation explicitly:

- **Public baseline:** GLM-5.2 Agent plus mandatory Function retrieval.
- **Private candidate:** the same Function plus methodology-only Knowledge Base
  retrieval, backed by Managed OpenSearch and held behind evaluation.

Replace “every answer ships with its tool-call trace” with “private probes and
evaluations preserve tool-call traces; public answers preserve evidence URLs,
dates, data status, and limitations.”

### Slide 11 — close

Add a final stack line under the URL or QR code:

> App Platform · Managed PostgreSQL · Spaces · Functions · Agent Platform
> (GLM-5.2) · Knowledge Base / Managed OpenSearch · Agent Evaluations

## Presenter version

The 30-second DigitalOcean explanation:

> We did not bolt a model onto a static civic-data demo. App Platform runs the
> product; Managed PostgreSQL holds the atomic current evidence graph; private
> Spaces preserves the exact public-record inputs; a DigitalOcean Function is
> the only route by which the Agent can obtain site facts; and Agent Platform
> streams a GLM-5.2 explanation of that bounded packet. Our private replacement
> adds methodology RAG through a Knowledge Base backed by Managed OpenSearch,
> and Agent Evaluations gates its promotion. The model explains the evidence;
> DigitalOcean makes the entire proof path deployable, durable, secure, and
> measurable.

## Claims to avoid

- “Owner” or “ownership history.” Say “assessment” or “tax-roll history.”
- “Nightly refresh.” Refresh is request-driven.
- “Graph database” or “pgvector.” The typed application graph is stored as
  versioned PostgreSQL snapshots; methodology retrieval uses Managed
  OpenSearch.
- “Knowledge Base contains site evidence.” Site facts come only through the
  Function packet.
- “Evaluations gate every release.” They gate candidate Agent promotion.
- “`/healthz` proves live data.” Pair it with `/api/data-status`.
- “Every public response exposes a tool trace.” Traces are verified through
  private probes and evaluation; public responses expose evidence and limits.
