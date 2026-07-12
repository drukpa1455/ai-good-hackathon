# What We Learned Building an Evidence-First Civic AI Agent in 24 Hours

> **Public case study.** Groundwork SF was built and deployed for the
> July 2026 AI for Social Good hackathon, then permanently torn down after its
> demonstration window. This independent participant account is not an official
> DigitalOcean publication.

![Groundwork SF canonical evidence-drawer design](../assets/groundwork-evidence.png)

The easiest version of our hackathon project was a chatbot over public data.
It would also have been the wrong product.

San Francisco publishes rich records about parcels, development projects,
permits, assessment history, housing programs, hazards, and neighborhood
signals. The hard problem is not generating a fluent summary. It is preserving
which record supports each statement, when that record applies, what geographic
scope it describes, and what the source does not establish.

We built Groundwork SF around one rule:

> Every public-record claim should carry its proof.

That rule shaped the interface, data model, Agent, cloud architecture, and even
the teardown plan.

## A graph, not a generated answer, owns the facts

Groundwork compiles bounded DataSF responses into a typed context graph. The
graph contains entities, assertions, evidence records, dates, diagnostics, and
release identity. Every assertion names at least one evidence record. Missing,
historical, stale, conflicting, and proximity-only evidence remain different
states.

```text
Site
  |
  +-- Entity
  |
  +-- Assertion --> Entity or Literal
  |      |
  |      +--> EvidenceRecord
  |
  +-- Diagnostic
         freshness | conflict | coverage_gap | proximity_only
```

This matters because common shortcuts change meaning. No row in an old housing
program layer is not proof of current ineligibility. A 311 count within 150
meters describes the surrounding area, not the parcel. Two dated status records
should not be silently collapsed into one supposedly current value.

Deterministic Python owns those distinctions. The language model never creates
the graph, selects hidden records, or repairs missing evidence.

## DigitalOcean carried the complete proof path

We did not use the sponsor platform as a logo beside an otherwise unrelated
application. Each managed service owned a visible system responsibility.

| DigitalOcean service | Groundwork responsibility |
| --- | --- |
| App Platform | Run one tested React and FastAPI revision |
| Managed PostgreSQL | Store versioned graph snapshots, evidence rows, refresh leases, and the atomic current pointer |
| Spaces | Preserve immutable, content-addressed source projections and methodology documents |
| Functions | Constrain Agent access to one authenticated graph-packet route |
| Agent Platform | Run the GLM-5.2 evidence explainer and generated chat widget |
| Knowledge Base | Retrieve stable methodology without owning site facts |
| Managed OpenSearch | Back the methodology retrieval index |
| Agent Evaluations | Measure a candidate before promotion |

The result had one clear flow:

```text
Browser <--> App Platform <--> PostgreSQL
                         +--> Spaces
                         +--> bounded DataSF queries

Browser --> Agent Platform --> secure Function --> protected graph packet
                         +--> Knowledge Base --> Managed OpenSearch
```

The platform breadth was useful because it let us demonstrate the complete
system rather than a local notebook: ingestion, durable state, immutable
evidence, bounded tools, managed RAG, streamed interaction, evaluation, and
deployment.

## We separated facts from methodology

Groundwork has two retrieval planes.

The **site-fact plane** is deterministic. A request resolves one known site,
loads or refreshes its graph, and renders a size-bounded packet containing only
selected facts, evidence URLs, dates, status, and diagnostics. A DigitalOcean
Function authenticates to the protected FastAPI route, rejects redirects,
limits response bytes, and verifies the packet's SHA-256 digest.

The **methodology plane** is conventional RAG. Four stable documents explain
graph semantics, source definitions, responsible use, and how to interpret
missing or qualified evidence. A DigitalOcean Knowledge Base indexes those
documents in Managed OpenSearch.

The routing rule is simple:

```text
Question about a site?      Function packet required.
Question about method?      Knowledge Base allowed.
Function unavailable?       Methodology cannot replace facts.
```

Without that separation, a semantically relevant methodology passage could
sound like evidence about a real site. With it, each retrieval system has one
kind of authority.

## The Agent was deliberately less powerful

The Agent received no database credential, arbitrary SQL tool, general graph
query language, DataSF token, or unrestricted HTTP client. It could call one
Function with a site identifier, one of five focus values, and the original
question.

Only a successful `ok` response contained a usable packet. `not_found`,
`invalid_request`, `context_too_large`, and `unavailable` were explicit tool
states. The instructions required a successful packet before any site-specific
answer and prohibited filling gaps from model memory.

This is the design decision that made the AI useful: the model could translate
a dense evidence graph into a readable explanation, while the application
retained authority over identity, joins, dates, citations, and uncertainty.

## Evaluation became a promotion gate

We created a fixed 50-query corpus covering grounding, citation, freshness,
ambiguous addresses, missing records, proximity, refusals, prompt injection,
and methodology routing.

The public Function-backed Agent and a private candidate were separate
configurations. The candidate added methodology retrieval, but it remained
private when its managed evaluation missed the required gate. We did not lower
the standard because the demo deadline was close.

That distinction is important:

- deterministic tests gate application behavior;
- graph validation gates data publication; and
- Agent Evaluations gate conversational configuration.

One score does not own all three revisions.

## Stable boundaries made parallel work possible

A 24-hour build rewards speed, but uncontrolled speed creates two half-products.
We instead froze a small frontend contract and gave each layer one owner.

The React application consumed a single `ContextClient`, so it could run against
deterministic fixtures while the backend, DataSF compiler, PostgreSQL store,
Spaces adapter, Function, and Agent were built independently. Mock and HTTP
modes returned the same shapes. Components never queried DataSF or inspected
cloud credentials.

That contract let the design and data work proceed in parallel without a later
rewrite. The demo fixtures were not throwaway UI data; they were a
hash-validated fallback using the production graph schema.

## Teardown was part of the architecture

A public Agent that anyone can invoke is a metered, abuse-prone endpoint. We
therefore treated public access as a lease rather than a permanent default.

The Agent stayed private until its Function path passed direct and private
probes. The generated widget was allowed only on the exact App domain. After
the demonstration, we disabled the widget, made the Agent private, and deleted
the dependent resources in order: Agents and Knowledge Base, Function
namespace, App, PostgreSQL and OpenSearch clusters, then Spaces buckets.

We read the resource inventory back after deletion instead of assuming a
successful teardown from a command response. The repository now preserves the
architecture and deterministic demo without leaving a public inference bill
running.

## What we would carry into a real product

The 24-hour system is deliberately small, but the central primitives scale:

1. Give structured facts one deterministic owner.
2. Attach evidence and dates before inference.
3. Keep live fact retrieval separate from interpretive document RAG.
4. Give an Agent the narrowest useful tool response.
5. Make failure states machine-readable and fail closed.
6. Evaluate product semantics, not just prose quality.
7. Treat public inference, spend, revision, and teardown as owned state.

The same pattern applies to compliance evidence, supply-chain events, research
claims, and incident histories—anywhere a fluent answer is less important than
knowing exactly why it should be believed.

The complete implementation is in the
[Groundwork SF repository](https://github.com/drukpa1455/ai-good-hackathon).
For a step-by-step technical walkthrough, read
[How To Build Evidence-First Graph RAG on DigitalOcean](evidence-first-graph-rag-on-digitalocean.md).
