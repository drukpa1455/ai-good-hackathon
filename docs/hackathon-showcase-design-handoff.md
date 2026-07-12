# Design Handoff: Hackathon Studio and Groundwork SF Story

Status: Ready for static design prototype

Audience: Design/frontend agent working independently from the Groundwork
product application

Source repository: <https://github.com/drukpa1455/ai-good-hackathon>

Working branch content is unpublished. Do not push, deploy, or make the
DigitalOcean tutorial publicly accessible without explicit publication
approval.

## Mission

Design a polished static HTML showcase that can grow into a home for multiple
hackathon projects and technical tutorials. The first complete project story is
Groundwork SF.

This is a portfolio and publishing surface, not another product frontend. It
should help a visitor understand four things quickly:

1. what was built;
2. why it matters;
3. how the system works; and
4. where to explore the code, demo media, and eventual tutorial.

The first prototype must work entirely from local content and media. It must
not require a live Agent, DigitalOcean credentials, a database, or the
Groundwork API.

## Publication Boundary

The Groundwork project and Devpost story are already public. The draft article
`docs/digitalocean-technical-post.md` is not public and is being reserved for a
possible original, first-run DigitalOcean Community publication.

The design may use:

- public copy from `README.md` and `docs/devpost.md`;
- the launch copy in `docs/linkedin-post.md`;
- architecture already documented publicly in `docs/architecture.md`;
- screenshots and recorded demonstrations cleared for public use; and
- links to the public repository and hackathon.

Until editorial disposition, the design must not:

- render or bundle the full DigitalOcean tutorial;
- expose the article Markdown through a route, source map, JSON payload, or
  static asset;
- quote substantial unpublished tutorial passages;
- advertise a tutorial URL that does not exist; or
- expose a public Agent merely to make the showcase interactive.

Use a disabled tutorial card labeled **Technical walkthrough in editorial
review**. Make its state content-driven so it can later change to `published`
and receive a canonical URL without redesigning the page.

## Recommended Delivery Shape

Create the prototype as a self-contained static site outside the Groundwork
application. The durable target should be a dedicated repository, provisionally
called `hackathon-studio`, deployed with GitHub Pages and a custom domain only
after repository and publication approval.

Use the smallest maintainable implementation:

```text
hackathon-studio/
  index.html
  projects/
    groundwork-sf/
      index.html
  writing/
    index.html
  assets/
    styles.css
    site.js
    images/
      groundwork-sf/
  content/
    projects.json
    writing.json
  404.html
  README.md
```

Plain semantic HTML, CSS, and minimal JavaScript are sufficient for the first
version. Do not introduce a framework, CMS, database, authentication layer, or
client-side router unless a second project proves that static composition is
no longer adequate. Repeated cards may be generated at build time later; they
do not justify a runtime dependency now.

For this task, create only a local prototype under a disposable working
directory. Do not initialize or publish the new repository.

## Information Architecture

### Home — `/`

- concise studio statement;
- featured project card for Groundwork SF;
- small project index designed to accept future entries;
- writing/tutorial index with visible publication states;
- brief principles section: evidence, bounded AI, public-interest technology;
- links to GitHub and LinkedIn without a newsletter or contact backend.

The home page should remain credible with one project. Avoid empty grids,
inflated statistics, fake testimonials, invented clients, and “coming soon”
cards for projects that do not exist.

### Project story — `/projects/groundwork-sf/`

The page should read as a visual engineering case study:

1. **Hero:** project name, one-sentence outcome, event, date, repository link,
   and a product still or short muted recording.
2. **Problem:** fragmented civic records and the danger of ungrounded summary.
3. **Product:** synchronized map, context graph, evidence drawer, trust panel,
   and bounded Agent explanation.
4. **Evidence interaction:** one assertion expanded to its exact source, dates,
   digest, and diagnostic.
5. **Architecture:** the complete DigitalOcean system with one responsibility
   per component.
6. **Trust model:** graph facts, methodology RAG, and model explanation as
   separate ownership planes.
7. **Demo story:** successful exact-address retrieval plus ambiguous-address
   clarification.
8. **Build details:** technology and tests, subordinate to the system story.
9. **Links:** repository, Devpost event, optional recorded demo, and tutorial
   state.

### Writing — `/writing/`

Render article metadata from `content/writing.json`. Each entry needs:

```json
{
  "slug": "evidence-first-graph-rag-digitalocean",
  "title": "How To Build Evidence-First Graph RAG on DigitalOcean",
  "summary": "A two-plane architecture for typed facts, methodology retrieval, and bounded model explanation.",
  "status": "editorial-review",
  "published_at": null,
  "canonical_url": null
}
```

Allowed states are `editorial-review` and `published`. Only `published` entries
may render an article link. When DigitalOcean publishes the tutorial, point the
card directly to its canonical DigitalOcean URL. Do not duplicate the complete
article on the studio site unless its publication agreement permits
republication and the canonical-link requirements are satisfied.

## Groundwork Story Copy

### Eyebrow

AI for Social Good · San Francisco · 24-hour build

### Headline

Every public-record claim should carry its proof.

### Summary

Groundwork SF turns fragmented public records into a proof-carrying context
graph for community housing research. Every visible claim links to evidence,
dates, and limitations; an AI assistant may explain a bounded graph packet but
does not own the facts.

### Problem statement

Parcel, permit, development, assessor, housing-program, hazard, and
neighborhood records live in different public datasets. Combining them into a
confident narrative can erase source dates, conflicts, geographic scope, and
missing-data boundaries. Groundwork keeps those limits visible.

### Architecture statement

Deterministic compiler code owns graph identity, joins, assertions, evidence,
and diagnostics. DigitalOcean App Platform serves the product; Managed
PostgreSQL stores graph snapshots; private Spaces preserves source projections;
a secure Function retrieves one bounded packet for Agent Platform; and a
methodology-only Knowledge Base backed by Managed OpenSearch remains separate
from site facts.

### Primary links

- Repository: <https://github.com/drukpa1455/ai-good-hackathon>
- Hackathon: <https://ai-for-social-good-mlh.devpost.com/>
- Live application: <https://groundwork-sf-demo-iule6.ondigitalocean.app>

The live-application link is optional. Render it only while the approved demo
revision and public window are verified. A recorded demo is the default durable
artifact.

## Visual Direction

The studio should feel like a precise independent engineering publication:
warm, editorial, technically serious, and visibly human. It should not resemble
a startup landing-page template, generic AI dashboard, cloud-provider marketing
page, or award gallery.

Use:

- a restrained editorial type scale;
- warm paper and deep ink surfaces with one electric civic accent;
- diagrams as first-class reading surfaces;
- generous space around technical content;
- thin graph lines and small schema glyphs as a recurring motif;
- strong captions that explain why each image matters;
- dark and light themes only if both are fully resolved; and
- motion only for progressive graph disclosure or media playback.

Avoid:

- decorative AI gradients, glowing orbs, and fake terminal animations;
- unsupported performance or impact metrics;
- DigitalOcean branding that implies an official partnership;
- screenshots of dense cloud consoles as hero imagery;
- autoplay audio or background video; and
- hidden interaction required to understand the architecture.

## Required Design References

Study the existing visual work before choosing a new direction:

- [Claude Design project](https://claude.ai/design/p/4919ebb1-b8c1-440c-81e2-e86ee7e89ab0)
- [Brand Kit Dark](https://claude.ai/design/p/4919ebb1-b8c1-440c-81e2-e86ee7e89ab0?file=Brand+Kit+Dark.dc.html)
- [Brand Kit Light](https://claude.ai/design/p/4919ebb1-b8c1-440c-81e2-e86ee7e89ab0?file=Brand+Kit+Light.dc.html)
- [Schema Glyphs](https://claude.ai/design/p/4919ebb1-b8c1-440c-81e2-e86ee7e89ab0?file=Schema+Glyphs.dc.html)

These references establish useful color, typography, glyph, and graph language.
Adapt them into an editorial system; do not reproduce the product shell as the
portfolio shell.

## Asset List

The local prototype may use placeholders with exact aspect ratios, but final
publication requires:

1. `groundwork-hero.webp` — 16:10 product overview.
2. `groundwork-evidence.webp` — evidence drawer with source and dates.
3. `groundwork-architecture.svg` — complete system diagram.
4. `groundwork-grounded-answer.webp` — successful bounded Agent response.
5. `groundwork-ambiguity.webp` — clarification for an ambiguous identifier.
6. `groundwork-demo.mp4` — optional 30–45 second muted recording.
7. `groundwork-social-1200x627.png` — LinkedIn link-preview image.
8. `groundwork-square-1080.png` — first carousel slide or project card.

All screenshots must use public demo records, hide credentials and cloud
identifiers, and remain understandable with adjacent captions. Provide alt text
for every meaningful image.

## Responsive and Accessibility Requirements

- Support 1440, 1024, 768, and 390 CSS-pixel widths.
- Use landmarks, a logical heading order, and visible keyboard focus.
- Keep body copy at a readable measure of approximately 65–75 characters.
- Preserve diagram meaning without color and provide a textual explanation.
- Respect reduced motion and high contrast.
- Prevent horizontal page scrolling; code and wide diagrams may scroll within
  labeled containers.
- Meet WCAG 2.2 AA contrast for text and interactive controls.
- Give the muted recording visible play, pause, restart, and caption controls.

## Prototype Acceptance

- The home page works honestly with exactly one project and one unpublished
  tutorial card.
- The Groundwork story is understandable without opening the repository or
  live application.
- The DigitalOcean architecture is prominent but not promotional filler.
- The tutorial cannot be reached, extracted, or accidentally bundled.
- The live demo can be removed without leaving a broken layout.
- All primary content works without JavaScript.
- The prototype has no network calls, secrets, analytics, forms, or backend.
- Desktop and mobile screenshots are ready for review.
- The design agent returns a file manifest, design rationale, and notes on any
  content or asset gaps rather than publishing the site.

## Future Publication Flow

After design approval, create a dedicated repository and copy in only the
approved static site. GitHub Pages is appropriate for the durable portfolio
because the content is static, inexpensive, versioned, and independent of any
hackathon application's cloud lifetime. Keep project source in each project's
own repository and link to it from the studio.

If the collection later grows beyond a few projects, introduce a static site
generator only to own repeated layouts and Markdown compilation. Do not move
project APIs, live demos, credentials, or databases into the portfolio site.
