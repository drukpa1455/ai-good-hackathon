# Groundwork technical writing

Groundwork is both a working reference implementation and a source for focused
technical writing. This directory keeps publication state explicit so a public
piece is never mistaken for an unpublished pitch.

## Ready now

| Piece | Status | Best home |
| --- | --- | --- |
| [How To Build Evidence-First Graph RAG on DigitalOcean](evidence-first-graph-rag-on-digitalocean.md) | Public reference tutorial | GitHub, Hackathon Studio, personal publication |
| [What We Learned Building an Evidence-First Civic AI Agent in 24 Hours](groundwork-digitalocean-case-study.md) | Public case study | LinkedIn article, Hackathon Studio, personal publication |

The tutorial is now public. Do not submit that manuscript as original,
first-run DigitalOcean Community content. DigitalOcean's
[contributor page](https://www.digitalocean.com/community/pages/write-for-digitalocean)
requires original first-run work and, as of July 12, 2026, still carries a
stale notice saying new topics are paused until 2025. Verify that intake has
reopened before writing a new manuscript.

## Strong next tutorials

These are new pieces, not excerpts from the public tutorial. Each has one
reader outcome and a narrow source-code spine.

### Design a fail-closed tool contract for a DigitalOcean Agent

**Reader outcome:** build a secure web Function that calls one protected API,
bounds inputs, time, redirects, and bytes, verifies a response digest, and
returns an explicit success/failure union to Agent Platform.

**Code spine:**
[`functions/packages/context/get_site_context/`](../../functions/packages/context/get_site_context/),
[`backend/src/groundwork/agent_context.py`](../../backend/src/groundwork/agent_context.py),
[`ops/agent-function-route.json`](../../ops/agent-function-route.json), and
[`ops/agent-instructions.md`](../../ops/agent-instructions.md).

**Why it is distinct:** DigitalOcean already documents
[function routing](https://docs.digitalocean.com/products/inference/how-to/route-agent-functions/).
This tutorial would teach the application-level trust contract that keeps a
valid tool call from becoming an unbounded fact source.

### Publish proof-carrying snapshots with PostgreSQL and Spaces

**Reader outcome:** upload canonical source projections under content-derived
keys, verify their metadata, then atomically advance a PostgreSQL current
pointer only when a fenced refresh lease and the complete artifact receipt set
still match.

**Code spine:**
[`backend/src/groundwork/spaces.py`](../../backend/src/groundwork/spaces.py),
[`backend/src/groundwork/postgres.py`](../../backend/src/groundwork/postgres.py),
[`backend/src/groundwork/live_context.py`](../../backend/src/groundwork/live_context.py),
and [`backend/migrations/001_live_context.sql`](../../backend/migrations/001_live_context.sql).

**Why it is distinct:** this is a durability and concurrency tutorial, not a
generic database or object-storage setup guide.

### Turn evidence rules into an Agent promotion gate

**Reader outcome:** convert grounding, citation, freshness, ambiguity,
coverage, proximity, refusal, and prompt-injection requirements into a fixed
CSV corpus; run DigitalOcean Agent Evaluations; and keep a candidate private
when its star metric misses the threshold.

**Code spine:**
[`evaluations/groundwork-agent-v1.csv`](../../evaluations/groundwork-agent-v1.csv),
[`evaluations/README.md`](../../evaluations/README.md), and
[`docs/architecture.md`](../architecture.md).

**Why it is distinct:** DigitalOcean's
[evaluation guide](https://docs.digitalocean.com/products/inference/how-to/evaluate-agents/)
explains the platform workflow. This piece would teach how to derive a
behavioral release contract from product semantics and keep Agent promotion
separate from data publication.

### Run a public AI demo with a bounded exposure window

**Reader outcome:** deploy a known revision, prove Function use privately,
expose the generated Agent widget only on an allowed domain, record the demo,
then disable inference and tear down every dependent resource with readback.

**Code spine:** [`.do/app.yaml`](../../.do/app.yaml),
[`ops/digitalocean-demo-lease.md`](../../ops/digitalocean-demo-lease.md),
[`web/src/components/AgentWidget.tsx`](../../web/src/components/AgentWidget.tsx),
and [`Dockerfile`](../../Dockerfile).

**Why it is distinct:** the central problem is operational ownership—revision,
spend, public window, verification, and teardown—not merely embedding a
chatbot.

## Editorial sequence

1. Choose one focused tutorial; do not pitch the whole platform again.
2. Check DigitalOcean's current library for overlap and submit an outline
   before drafting.
3. Wait for editorial acceptance before creating paid clean-account resources.
4. Test every command from a tagged source revision and a disposable project.
5. Capture expected output, limits, costs, failure cases, and teardown.
6. Keep credentials, private identifiers, console exports, and mutable live
   claims out of the manuscript and repository.

The existing DigitalOcean article
[Beyond Vectors — Knowledge Graphs & RAG](https://www.digitalocean.com/community/tutorials/beyond-vectors-knowledge-graphs-and-rag)
builds a graph through entity extraction and Neo4j. Groundwork's useful
contribution is complementary: the application owns a typed evidence graph
before inference, and the model receives only a bounded projection of it.
