# Groundwork SF LinkedIn Launch

Everything here is ready to publish. The application itself is archived; the
repository and deterministic demo remain public.

## Upload

- **Document:** [groundwork-sf-carousel.pdf](assets/linkedin/groundwork-sf-carousel.pdf)
- **LinkedIn title:** `Groundwork SF — Evidence-First Civic AI`
- **Post copy:** use the text below verbatim, then replace the organization
  names with LinkedIn mentions if the composer resolves them.

## Post copy

We built Groundwork SF in 24 hours to answer one question:

Can AI make public data easier to use without making it easier to
misrepresent?

Community housing research often means reconciling parcels, development
projects, permits, assessor history, housing programs, hazard maps, and nearby
civic reports. A polished summary can hide where a claim came from, when its
source was observed, or what the records do not establish.

Groundwork SF takes a different approach: every public-record claim carries its
proof.

Seven San Francisco public datasets compile into one typed context graph. The
interface keeps its parcel map, evidence graph, source records, dates, and trust
diagnostics synchronized. For site questions, the AI agent must retrieve one
bounded, hash-verified graph packet and cite evidence inside it. The model
explains the graph; deterministic code owns identity, joins, facts, conflicts,
and missing-data semantics.

We deployed the complete path on DigitalOcean with App Platform, Managed
PostgreSQL, Spaces, Functions, Agent Platform, a Knowledge Base backed by
Managed OpenSearch, and Agent Evaluations. We verified it for the hackathon and
tore the public deployment down after the demo window.

The biggest lesson was architectural, not prompt-related: trustworthy AI starts
by deciding what the model is not allowed to own.

Source, architecture, and reproducible demo:
https://github.com/drukpa1455/ai-good-hackathon

Built for AI for Social Good with MLH × DigitalOcean:
https://ai-for-social-good-mlh.devpost.com/

#AIForGood #GraphRAG #ResponsibleAI #CivicTech #DigitalOcean #OpenData

## Carousel

| Page | Point | Asset |
| --- | --- | --- |
| 1 | Every public-record claim carries its proof | [01-proof.png](assets/linkedin/01-proof.png) |
| 2 | One canonical graph serves the product and Agent | [02-system.png](assets/linkedin/02-system.png) |
| 3 | Assertions retain their evidence and diagnostics | [03-contract.png](assets/linkedin/03-contract.png) |
| 4 | Site RAG is mandatory, bounded, and hash-verified | [04-boundary.png](assets/linkedin/04-boundary.png) |
| 5 | DigitalOcean owns the deployed service boundaries | [05-platform.png](assets/linkedin/05-platform.png) |

The first page embeds the canonical light-theme application design from the
final frontend handoff. Pages 2 and 5 were reconciled with implemented code:
the refresh lease is 20 seconds, the Function runtime is Python 3.13, and VPC
privacy is attributed only where the architecture provides it.

## Publish checklist

1. On LinkedIn, choose **Start a post → More → Add a document**.
2. Upload the PDF and enter the title above.
3. Preview all five pages; LinkedIn does not let you replace a document after
   publishing.
4. Paste the post copy and resolve `DigitalOcean` and `MLH` as organization
   mentions when available.
5. Publish from the intended personal profile or Page.

LinkedIn currently accepts PDF document posts up to 100 MB and 300 pages,
recommends PDF for quality, and requires equal page sizes. This package is a
five-page, same-size, flattened PDF under 1 MB. See LinkedIn's
[document-post guidance](https://www.linkedin.com/help/linkedin/answer/a518909/upload-and-share-documents-on-linkedin?lang=en).

If document upload is unavailable, attach the five numbered PNG files in order.
LinkedIn supports manual alt text for image posts; use each row's **Point** as
the concise description and add the visible diagram details. See LinkedIn's
[alt-text guidance](https://www.linkedin.com/help/linkedin/answer/a519856/adding-alternative-text-to-images-for-accessibility?lang=en).

## Later tutorial post

Follow the launch with the public implementation guide:

> I wrote the implementation walkthrough behind Groundwork SF: how to compile
> public records into a proof-carrying graph, give a DigitalOcean Agent one
> bounded and hash-verified site packet, keep methodology in a separate
> Knowledge Base, evaluate the Agent, and tear the public stack down safely.
>
> https://github.com/drukpa1455/ai-good-hackathon/blob/main/docs/writing/evidence-first-graph-rag-on-digitalocean.md
>
> #GraphRAG #AIEngineering #ResponsibleAI #DigitalOcean #TechnicalWriting
