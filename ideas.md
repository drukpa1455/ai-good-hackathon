# AI for Social Good Hackathon — Idea Notes

_Status: brainstorming only; no implementation repository chosen._

## Lead Idea: Reia Property Evidence Room

Select a San Francisco parcel and build a proof-carrying diligence memo from official records:

- assessor history and parcel characteristics
- building permits and proposed changes
- zoning, land use, affordable-housing eligibility, and hazards
- optional 2023 USGS LiDAR evidence for one small 3D area
- explicit contradictions, stale claims, missing data, and source dates

Deterministic tools own facts and comparisons. DigitalOcean Inference turns the evidence into a cited memo and refuses valuation, legal, safety, or buy/sell conclusions. DigitalOcean Evaluations test citations and numeric fidelity; App Platform can host the demo.

Social-good framing: first-pass site diligence for community land trusts or affordable-housing organizations.

## Other Finalists

1. Vacant commercial space to community use
2. Affordable-housing site evidence copilot
3. Accessible last-mile routing
4. Tree-care evidence map
5. 311 infrastructure evidence copilot as the low-risk fallback

## San Francisco 3D Sources

- Best open analytical source: 2023 USGS classified LiDAR, 0.15 m nominal pulse spacing and 0.25 m DEM products.
- Ready visual context: public Esri downtown 3D buildings, subject to Esri and Precision Light Works terms.
- Google Photorealistic 3D Tiles require billing, attribution, and platform terms.
- Aerometrex has commercial 2021 meshes; quote required.

Use 3D only as a stretch for one parcel or block, not as the critical path.

## Go/No-Go Before Building

1. Confirm hackathon judging criteria and required DigitalOcean capability.
2. Validate one compelling parcel and stable joins across official datasets.
3. Confirm the evidence tells a defensible story without paid property feeds.
4. Confirm the selected DigitalOcean model supports the required structured response or tool mode.
5. If property joins fail, switch immediately to Tree Care or 311.
