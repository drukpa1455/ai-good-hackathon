# Groundwork SF LinkedIn Package

This package promotes the public hackathon project and its technical-writing
collection. Link to tracked public pieces; never link to private branches or
imply official DigitalOcean publication.

## Recommended Launch Post

We built Groundwork SF in 24 hours because public data should be easier to use
without becoming easier to misrepresent.

Community housing teams often have to piece together parcels, development
projects, permits, assessor history, housing programs, hazard maps, and nearby
civic reports. A polished AI summary can hide where those records came from,
when they were observed, or what is missing.

Groundwork SF takes a different approach: every visible claim belongs to a
context graph and points back to its evidence.

The product combines a parcel map, an explorable evidence graph, source-level
dates and diagnostics, and an AI assistant that must retrieve a bounded graph
packet before answering site-specific questions. The model explains the
evidence; it does not own the facts.

We deployed the complete path on DigitalOcean using App Platform, Managed
PostgreSQL, Spaces, Functions, Agent Platform, a Knowledge Base backed by
Managed OpenSearch, and Agent Evaluations.

The most important lesson was architectural, not prompt-related: trustworthy
AI starts by deciding what the model is not allowed to own.

Source and architecture:
https://github.com/drukpa1455/ai-good-hackathon

Hackathon:
https://ai-for-social-good-mlh.devpost.com/

#AIForGood #GraphRAG #ResponsibleAI #CivicTech #DigitalOcean #OpenData

## Short Version

We built Groundwork SF in 24 hours: a proof-carrying civic context graph for
San Francisco community housing research.

Every claim links to evidence, dates, and diagnostics. A DigitalOcean AI agent
can explain a bounded graph packet, but deterministic code—not the model—owns
identity, joins, facts, conflicts, and missing-data semantics.

Our biggest lesson: trustworthy AI starts by deciding what the model is not
allowed to own.

https://github.com/drukpa1455/ai-good-hackathon

#AIForGood #GraphRAG #ResponsibleAI #CivicTech #DigitalOcean

## Media Recommendation

Use a native five-slide carousel or a 30–45 second silent screen recording.
Native media should carry the story; the live application is optional and
should not be exposed solely for the post.

Use the canonical design renders in `docs/assets/` for static product imagery.
Record interaction from the actual `web/` application, not the design
prototype, and keep the `MOCK DATA` label visible.

### Carousel

1. **Every public-record claim should carry its proof.** Product hero with map,
   graph, and evidence drawer.
2. **The problem is fragmented context.** Show the seven bounded public-data
   categories converging on one parcel.
3. **The graph owns the facts.** Show `Site -> Assertion -> EvidenceRecord` with
   dates, source URL, digest, and diagnostics.
4. **The model explains a bounded packet.** Show the Agent-to-Function path and
   one grounded answer with citations.
5. **Built on DigitalOcean in 24 hours.** Show the platform architecture and a
   repository call to action.

### Screen recording

1. Select 300 De Haro Street.
2. Expand its context graph.
3. Open the evidence behind the affordable-housing assertion.
4. Show dates, source URL, and coverage diagnostics.
5. Ask one grounded question and display its citations.
6. End on the architecture card and repository URL.

Do not show access tokens, cloud-resource identifiers, browser bookmarks, or a
publicly writable Agent endpoint. Use a recorded verified interaction if the
live Agent has been made private.

## Tutorial Follow-Up Post

Publish this after the main project post.

I wrote a technical walkthrough of the architecture behind Groundwork SF:
evidence-first Graph RAG on DigitalOcean.

The central pattern is a two-plane retrieval system:

- deterministic code compiles site facts into a typed, evidence-linked graph;
- a DigitalOcean Function gives the Agent one bounded, digest-verified packet;
- a separate Knowledge Base supplies methodology without becoming a fact
  source; and
- Agent Evaluations test grounding, freshness, ambiguity, citation, refusal,
  and prompt-injection behavior.

The tutorial includes the implementation boundaries, deployment path, failure
behavior, evaluation corpus, cost controls, and teardown.

https://github.com/drukpa1455/ai-good-hackathon/blob/main/docs/writing/evidence-first-graph-rag-on-digitalocean.md

#GraphRAG #AIEngineering #ResponsibleAI #DigitalOcean #TechnicalWriting
