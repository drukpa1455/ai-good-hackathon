# Canonical Design-Agent Prompt: Hackathon Studio

Copy everything below the divider into a fresh design/frontend agent session.
No earlier chat, addendum, or unpublished file is required.

---

Build a polished local prototype for **Hackathon Studio**, a durable home for
our hackathon projects, interactive archives, presentations, and technical
writing. Groundwork SF is the first complete project.

## Authority and inputs

The public source repository is:

<https://github.com/drukpa1455/ai-good-hackathon>

Work from current `origin/main`. Read these files completely before designing:

- `AGENTS.md`
- `README.md`
- `docs/linkedin-post.md` — public launch copy and media storyboard
- `docs/devpost.md` — public product story and demo script
- `docs/architecture.md` — implemented system architecture
- `docs/deck-review.md` — corrections and refinements for the presentation
- `docs/frontend-design-handoff.md` — Groundwork product semantics and visual
  background

Study these local inputs:

- `/Users/drk/Downloads/Groundwork Deck.pdf` — source presentation
- `/Users/drk/Downloads/SF Community Site Context Graph.zip` — Claude Design
  reference bundle

Study the existing visual references:

- <https://claude.ai/design/p/4919ebb1-b8c1-440c-81e2-e86ee7e89ab0>
- <https://claude.ai/design/p/4919ebb1-b8c1-440c-81e2-e86ee7e89ab0?file=Brand+Kit+Dark.dc.html>
- <https://claude.ai/design/p/4919ebb1-b8c1-440c-81e2-e86ee7e89ab0?file=Brand+Kit+Light.dc.html>
- <https://claude.ai/design/p/4919ebb1-b8c1-440c-81e2-e86ee7e89ab0?file=Schema+Glyphs.dc.html>

The `.dc.html` file in the ZIP is a design reference, not the shippable
application. The real application is the React/TypeScript/Vite project in
`web/`.

The two hero images under `docs/assets/` are canonical renders from that design
reference. They may be used for static editorial presentation, but any
interactive archive or screen recording must come from `web/` and retain its
visible mock-data labeling.

## Working boundary

Create the local prototype at:

`/Users/drk/src/hackathon-studio`

Do not publish it, initialize a public repository, configure a custom domain,
or create cloud resources. The Groundwork cloud deployment has been torn down;
do not recreate it or make an Agent public. Use local content, bundled mock
data, screenshots, and recorded interactions.

If a repeatable archive build requires changes to the Groundwork repository,
do not edit its root directly. Create a focused issue, branch, and `.worktrees/`
worktree there, then return the proposed diff for review. Do not copy or commit
`web/dist`, `node_modules`, credentials, source maps, provider identifiers, or
runtime state.

## Deliverable

Create a responsive static publication with these routes:

```text
/
/projects/groundwork-sf/
/projects/groundwork-sf/explore/
/projects/groundwork-sf/presentation/
/writing/
```

Use semantic HTML, CSS, and minimal JavaScript for the editorial site. Do not
add a CMS, database, authentication, analytics, forms backend, client-side
router, or a general frontend framework. The archived Groundwork application
is the one exception: preserve its existing React/Vite implementation rather
than recreating it.

The final site structure should be capable of deployment to GitHub Pages after
review, but this task ends with a local prototype and screenshots.

## Home — `/`

Create an editorial project index that remains honest and complete with one
project. Include:

- a concise Hackathon Studio statement;
- one featured Groundwork SF project card;
- a small structure ready for future real projects without empty placeholder
  cards;
- a writing index with explicit publication state;
- a short principles section about evidence, bounded AI, and public-interest
  technology; and
- links to the project repository and hackathon.

Do not invent clients, testimonials, impact numbers, awards, traffic, or future
projects.

## Groundwork project story — `/projects/groundwork-sf/`

Build a visual engineering case study around this message:

> Every public-record claim should carry its proof.

The page must explain:

1. fragmented parcel, development, permit, assessor, housing-program, hazard,
   and neighborhood records create an evidence problem;
2. Groundwork combines a parcel map, proof-carrying context graph, evidence
   drawer, and visible diagnostics;
3. deterministic compiler code owns identity, joins, facts, conflicts, dates,
   and missing-data semantics;
4. the model may explain a bounded graph packet but does not own the facts;
5. DigitalOcean App Platform, Managed PostgreSQL, private Spaces, Functions,
   Agent Platform, a Knowledge Base, Managed OpenSearch, and Agent Evaluations
   each have a distinct system responsibility; and
6. successful exact-address retrieval and ambiguous-address clarification are
   both important product outcomes.

Primary public links:

- Repository: <https://github.com/drukpa1455/ai-good-hackathon>
- Hackathon: <https://ai-for-social-good-mlh.devpost.com/>

The former live app was permanently torn down after the event. Do not render a
dead live-app link; use the archived interactive demo instead.

## Actual application archive — `/projects/groundwork-sf/explore/`

Host the actual `web/` application, not `Groundwork SF.dc.html`.

The application is authored in React/TypeScript but compiles to static HTML,
JavaScript, CSS, and fixtures with:

```bash
VITE_DATA_MODE=mock npm --prefix web run build
```

Create or specify a repeatable archive build that:

- builds from an immutable Groundwork tag and commit;
- uses bundled mock data and visibly retains mock-data labeling;
- requires no FastAPI service, database, Spaces bucket, DataSF request,
  DigitalOcean resource, or public Agent;
- configures the Vite base path for
  `/projects/groundwork-sf/explore/`;
- configures the router basename or another static-host-safe route strategy;
- supports direct visits and refreshes for site and evidence routes;
- shows source repository, tag, and commit as archive provenance;
- links to the project story, presentation, and source;
- excludes source maps and secrets; and
- places a slim external banner around the app reading **Interactive archived
  demo · bundled mock data · no live AI**.

Do not redesign the app inside the portfolio shell. Preserve the implemented
Groundwork interface.

The archive may load its attributed OpenStreetMap/CARTO raster tiles. This is
its only permitted runtime network dependency. Preserve attribution and never
vendor third-party tiles. If a fully offline archive is needed, use an
explicitly labeled static map image.

## HTML presentation — `/projects/groundwork-sf/presentation/`

Rebuild `/Users/drk/Downloads/Groundwork Deck.pdf` as a first-class semantic
HTML presentation. Apply the factual corrections in `docs/deck-review.md`.
The HTML is canonical; do not embed a PDF viewer or maintain separate slide
content.

The presentation must:

- provide one semantic section and stable fragment ID per slide;
- support arrow keys, Page Up/Page Down, Home/End, touch gestures, and visible
  previous/next controls;
- remain readable by ordinary scrolling without JavaScript;
- provide a slide overview;
- keep essential text and diagrams as HTML or SVG;
- expose notes only through explicit presenter mode;
- print with one slide per page;
- include useful alt text and a textual architecture explanation;
- link back to the project story and repository; and
- never iframe the live app or Agent.

Use this story sequence:

1. fragmented public records create an evidence problem;
2. every claim should carry its proof;
3. map, graph, evidence, and diagnostics form the product;
4. graph facts remain separate from model explanation;
5. DigitalOcean supplies the complete deployed path;
6. a grounded interaction demonstrates successful retrieval;
7. an ambiguous interaction demonstrates fail-closed behavior; and
8. the close points to the repository and eventual tutorial.

## Writing — `/writing/`

Add one content-driven card:

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

Render it as **Technical walkthrough in editorial review** with no article
link. The full manuscript is deliberately absent from the public repository to
preserve original, first-run DigitalOcean eligibility. Do not reconstruct,
quote extensively, expose, or bundle it. Only a later `published` state with a
canonical URL may create a link.

## LinkedIn and media assets

Use `docs/linkedin-post.md` as the source for launch copy and the media story.
Prepare:

- `groundwork-social-1200x627.png`;
- `groundwork-square-1080.png`;
- a five-slide LinkedIn carousel;
- `groundwork-presentation-poster.webp`;
- `groundwork-explore-poster.webp`; and
- an optional 30–45 second muted demo video with visible controls and captions.

Use public demo records. Hide credentials, cloud identifiers, browser chrome,
and private operational details. A recorded verified Agent interaction is
preferred to a live public Agent.

## Visual direction

Create an independent engineering publication: warm, editorial, civic,
precise, and visibly human. Use strong typography, generous reading space,
first-class diagrams, thin graph lines, schema glyphs, clear captions, and one
electric civic accent.

Avoid generic AI gradients, glowing orbs, fake terminals, cloud-console hero
screenshots, autoplay audio, unsupported metrics, and DigitalOcean branding
that implies an official partnership. Do not copy the product application
shell as the portfolio shell.

## Accessibility and responsive behavior

- Support 1440, 1024, 768, and 390 CSS-pixel widths.
- Meet WCAG 2.2 AA contrast.
- Use landmarks, logical headings, visible focus, and 44-pixel touch targets.
- Respect reduced motion and high contrast.
- Keep article copy near a 65–75-character reading measure.
- Make diagrams understandable without color.
- Keep the editorial shell, project story, writing page, and presentation
  readable without JavaScript.
- Clearly label the archived React application as requiring JavaScript.
- Prevent page-level horizontal scrolling; place wide code and diagrams inside
  labeled scroll regions.

## Acceptance criteria

- The home page looks intentional with exactly one project.
- The Groundwork story is understandable without the live app or repository.
- The archive is built from `web/`, never from the Claude `.dc.html` prototype.
- The archive uses bundled mock data without backend or cloud dependencies.
- Direct archived site and evidence URLs work on a static host.
- The presentation works through keyboard, touch, scrolling, overview, and
  printing.
- The DigitalOcean architecture is prominent and technically accurate.
- The unpublished tutorial cannot be reached or extracted.
- Removing the optional live-app link leaves no broken layout.
- The editorial pages have no runtime API calls, analytics, secrets, or
  backend. Only the archived app's attributed map tiles may use the network.
- Desktop and mobile screenshots are ready for review.

## Return when complete

Do not publish. Return:

1. the local prototype path;
2. a complete file manifest;
3. exact local preview and build commands;
4. desktop and mobile screenshots for every route;
5. the presentation overview screenshot;
6. the LinkedIn carousel and social preview;
7. a concise design rationale;
8. accessibility and responsive verification results;
9. any proposed Groundwork source diff needed for static archive routing; and
10. a short list of missing assets or unresolved decisions.
