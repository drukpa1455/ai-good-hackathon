# Groundwork SF — Devpost submission

Submitted July 11, 2026 to
[AI for Social Good: Hack with MLH & DigitalOcean](https://ai-for-social-good-mlh.devpost.com/).

This document preserves the public project copy and demo script. It is a
submission artifact, not the operational source of truth; current
implementation and deployment status remain owned by the repository README and
the deployed application's health response.

## Project overview

**Tagline:** Every public-record claim should carry its proof.

Groundwork SF combines a proof-carrying civic evidence graph with a
Function-backed DigitalOcean AI agent so community housing teams can inspect
every claim, source, and limitation around a site.

## Inspiration

Community land trusts and affordable-housing organizations often need a quick,
defensible picture of what is happening at a site. The relevant public records
exist, but they are spread across parcel, assessment, permit, development,
housing-program, hazard, and neighborhood datasets. A polished summary can
make that fragmentation worse by hiding source dates, missing rows, and
conflicting records.

We built **Groundwork SF** around a simple belief: every civic-data claim
should carry its proof.

## What it does

Groundwork SF is a proof-carrying site-context explorer for San Francisco
community housing research. Choose one of three demo sites and the interface
synchronizes:

- a parcel map;
- a navigable context graph;
- focus views for housing, permits, hazards, and neighborhood signals;
- evidence records with dataset identity, record key, observation date,
  source date, license, and official source link; and
- deterministic trust metrics for citation coverage, freshness warnings,
  conflicts, coverage gaps, and proximity-only evidence.

Clicking a graph claim opens the exact evidence record that supports it. A
missing row stays a coverage gap instead of becoming a negative claim, and a
nearby 311 count stays a neighborhood signal instead of being attributed to
the parcel.

The deployed release compiles **three featured sites from bounded live DataSF
queries** across seven public datasets. Every live graph carries source and
retrieval dates, diagnostics, and content-addressed evidence artifacts. The API
reports live, stale, refreshing, and fixture states; the interface labels
fixture fallback and keeps source-level freshness diagnostics visible.

The embedded AI assistant provides a conversational path through the same
evidence. Before answering any site-specific question, the DigitalOcean agent
calls a secure Function to retrieve a bounded graph packet. Its answer cites
only URLs from that packet, repeats material freshness and coverage warnings,
and refuses legal, safety, valuation, suitability, ranking, or investment
conclusions. The graph remains the source of truth; the model explains it.

## How we built it

One canonical graph contract owns sites, entities, assertions, evidence,
diagnostics, and release metadata. A bounded DataSF compiler creates validated
live snapshots; Managed PostgreSQL stores current graph state and private
DigitalOcean Spaces stores immutable source projections. A SHA-256 manifest
and Pydantic models validate the deterministic fallback release.

A FastAPI service owns four public read routes plus a protected agent-context
route. The React and TypeScript frontend consumes those routes through one
`ContextClient` boundary. Cytoscape.js renders the graph, MapLibre GL JS renders
the map, and URL-backed selection makes sites, focus views, and evidence
records deep-linkable.

The product runs as one multi-stage Docker image on DigitalOcean App Platform.
Its health response exposes the deployed Git revision and graph release so the
demo can be tied to the exact code and data that were tested.

For the AI path, a secure DigitalOcean Function validates scalar tool inputs,
calls the protected application route with a separate bearer credential,
rejects redirects and oversized responses, and verifies the returned packet's
SHA-256 digest. A `glm-5.2` agent on DigitalOcean Gradient AI Platform is
instructed to call that Function before every site-specific answer. The
browser receives only the generated widget's public identifiers; no model key
or Function credential reaches the client.

A methodology-only DigitalOcean Knowledge Base backed by Managed OpenSearch
provides stable graph semantics without owning site facts. The replacement
agent remains private until its fixed 50-query managed evaluation passes; the
deployed widget stays on the prior Function-backed agent until that gate clears.

We verified the deployed flow end to end: the agent produced a real Function
trace for factual and uncertainty questions, preserved packet status, dates,
diagnostics, and citations, and refused an investment recommendation. The
frontend uses DigitalOcean's generated streaming widget, so the provider owns
chat transport, history, feedback, and rendering while Groundwork owns the
evidence product.

We test the Python boundaries with pytest and `unittest`, the frontend with
Vitest, and the desktop/mobile product flow with Playwright and axe. The same
browser suite runs in deterministic mock mode and against the deployed API
contract.

## Challenges we faced

The hardest problem was not drawing a graph; it was preserving meaning across
boundaries. Dates can describe a source update, an observation, or an event.
An absent record may mean a true negative, stale coverage, or a failed join.
Nearby events are not parcel facts. We modeled those distinctions explicitly
and kept them visible instead of smoothing them into a confident summary.

We also had to keep AI in the right role. Deterministic code owns identity,
joins, facts, dates, limits, and citations. The model may explain a bounded
packet, but it cannot become the source of site facts. That led us to a small,
hash-verified Function contract rather than a general chatbot or
natural-language database interface.

Finally, a dense evidence graph had to work on both a 1440-pixel desktop and a
390-pixel phone without hiding provenance or accessibility controls. The final
design uses a parallel keyboard list, mobile graph/map/evidence tabs, visible
map attribution, deep links, and diagnostics that remain reachable around the
chatbot launcher.

## What we learned

- Provenance works best as a product primitive, not a footnote.
- “Unknown,” “historical,” and “nearby” are different states and deserve
  different UI and contracts.
- An AI assistant can be more trustworthy when its retrieval surface is
  smaller, deterministic, and inspectable.
- A stable client and repository boundary let us activate live compilation and
  durable storage without rewriting the experience.

## What's next

Next we will expand beyond three deep live sites, improve the compact agent
response contract until the fixed evaluation clears its promotion gate, and
work with community land trusts to decide which evidence and uncertainty
signals are most useful.

## Built with

React, TypeScript, Vite, Cytoscape.js, MapLibre GL JS, FastAPI, Python,
Pydantic, Docker, OpenStreetMap, DigitalOcean App Platform, DigitalOcean
Managed PostgreSQL, Spaces, Managed OpenSearch, Functions, Knowledge Bases,
Gradient AI Platform, Agent Evaluations, GLM-5.2, Vitest, Playwright, pytest,
and axe-core.

## Links

- [Source code](https://github.com/drukpa1455/ai-good-hackathon)
- [Live demo](https://groundwork-sf-demo-iule6.ondigitalocean.app)
- [Hackathon](https://ai-for-social-good-mlh.devpost.com/)

## Prize categories

- **Best Use of DigitalOcean AI Platform in a Social Good Hack** — a real
  `glm-5.2` agent retrieves every site answer through a secure DigitalOcean
  Function and streams through the generated widget.
- **Best Use of Data** — the product makes fragmented civic evidence,
  provenance, dates, conflicts, and coverage gaps directly inspectable.
- **Best UI/UX** — supported by the responsive evidence workflow and automated
  accessibility checks.

## 90-second demo script

**0:00–0:12 — Problem.** “Public records can help community housing teams
understand a site, but the facts are fragmented and polished summaries often
hide dates, gaps, and uncertainty.”

**0:12–0:27 — Overview.** Open 300 De Haro. “Groundwork SF turns that research
into an evidence graph. The map, entities, assertions, and trust strip all come
from one validated graph snapshot. Source dates and stale diagnostics remain
visible, and fixture fallback is always labeled.”

**0:27–0:45 — Proof.** Select “300 De Haro project,” then open “affordable units
425.” “Every claim opens its supporting evidence record, including the dataset,
record key, dates, license, fields used, and official source link.”

**0:45–1:02 — Uncertainty.** Switch to 758/772 Pacific and open Diagnostics.
“Groundwork never turns uncertainty into confidence. This 2015 housing-program
match is explicitly historical, the flood layer is stale, and the 311 count is
proximity-only.”

**1:02–1:20 — Live agent.** Ask, “What evidence supports the 425 affordable-unit
figure at 300 De Haro?” “The DigitalOcean agent calls our secure Function before
answering. The Function retrieves a bounded, hash-verified packet, and the
streamed answer preserves the packet status and uses only packet citations.”

**1:20–1:30 — Close.** “Deterministic code owns the facts; AI explains them.
Groundwork makes civic AI useful by keeping the claim, proof, and limits
together.”
