# AI for Social Good Hackathon — Idea Notes

_Status: brainstorming only; no final concept selected._

## Lead Idea: San Francisco Community Site Context Graph

Select a San Francisco parcel and build a proof-carrying community site brief from official records:

- [assessor history and parcel characteristics](https://data.sfgov.org/Housing-and-Buildings/Assessor-Historical-Secured-Property-Tax-Rolls/wv5m-vpq2/about_data)
- [building permits and proposed changes](https://data.sfgov.org/Housing-and-Buildings/Building-Permits/i98e-djp9/about_data)
- [development pipeline projects](https://data.sfgov.org/Housing-and-Buildings/San-Francisco-Development-Pipeline/6jgi-cpb4/about_data)
- zoning, land use, affordable-housing eligibility, and hazards
- optional [2023 USGS LiDAR](https://www.fisheries.noaa.gov/inport/item/73386) evidence for one small 3D area
- explicit contradictions, stale claims, missing data, and source dates

The canonical graph owns sources, records, entities, events, assertions, relationships, and evidence state. Evidence packets, vector indexes, context subgraphs, and generated briefs are projections. Deterministic tools own identity, joins, dates, geometry, comparisons, citations, and conflict state.

For the demo, preload a small set of deep, compelling parcel graphs and label the coverage explicitly. A DigitalOcean agent combines graph-tool results with managed knowledge-base retrieval, explains the bounded context, answers follow-up questions, and refuses valuation, legal, safety, or buy/sell conclusions.

DigitalOcean owns the hosted demo stack: Managed PostgreSQL for the canonical graph, Spaces for immutable source snapshots and knowledge-base inputs, Knowledge Bases and OpenSearch for unstructured RAG, Functions for agent graph-query routes, Agent Platform for chat, Evaluations for groundedness and refusal tests, and App Platform for the interactive application.

The judge-facing experience is a synchronized map, context graph, evidence viewer, chatbot, selected-site provenance panel, and latest fixed agent evaluation showing citation coverage, numeric fidelity, disclosed conflicts, stale-source warnings, and unsupported-claim count.

Social-good framing: first-pass site diligence for community land trusts or affordable-housing organizations.

## Other Finalists

1. Vacant commercial space to community use
2. Affordable-housing site evidence copilot
3. Accessible last-mile routing
4. Tree-care evidence map
5. 311 infrastructure evidence copilot as the low-risk fallback

## San Francisco 3D Sources

- Best open analytical source: [2023 USGS classified LiDAR](https://www.fisheries.noaa.gov/inport/item/73386), with 0.15 m nominal pulse spacing and 0.25 m DEM products.
- Ready visual context: the public [Esri San Francisco 3D Buildings](https://www.arcgis.com/home/item.html?id=d3344ba99c3f4efaa909ccfbcc052ed5) scene layer, subject to Esri terms and Precision Light Works credit.
- [Google Photorealistic 3D Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles) require billing, attribution, and Google Maps Platform terms.
- [Aerometrex](https://aerometrex.com/models/san-francisco-3d-model-2cm/) offers commercial 2021 meshes; quote and license required.

Use 3D only as a stretch for one parcel or block, not as the critical path.

## Go/No-Go Before Building

1. Confirm hackathon judging criteria and required DigitalOcean capability.
2. Validate one compelling parcel and stable joins across official datasets.
3. Confirm the evidence tells a defensible story without paid property feeds.
4. Confirm the selected DigitalOcean model supports the required structured response or tool mode.
5. If property joins fail, switch immediately to Tree Care or 311.
