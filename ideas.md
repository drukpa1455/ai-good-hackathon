# AI for Social Good Hackathon — Idea Notes

_Status: brainstorming only; no final concept selected._

## Lead Idea: Reia Property Evidence Room

Select a San Francisco parcel and build a proof-carrying diligence memo from official records:

- [assessor history and parcel characteristics](https://data.sfgov.org/Housing-and-Buildings/Assessor-Historical-Secured-Property-Tax-Rolls/wv5m-vpq2/about_data)
- [building permits and proposed changes](https://data.sfgov.org/Housing-and-Buildings/Building-Permits/i98e-djp9/about_data)
- zoning, land use, affordable-housing eligibility, and hazards
- optional [2023 USGS LiDAR](https://www.fisheries.noaa.gov/inport/item/73386) evidence for one small 3D area
- explicit contradictions, stale claims, missing data, and source dates

Deterministic tools own facts and comparisons. [DigitalOcean Inference](https://docs.digitalocean.com/products/inference/) turns the evidence into a cited memo and refuses valuation, legal, safety, or buy/sell conclusions. Evaluations test citations and numeric fidelity; [App Platform](https://docs.digitalocean.com/products/app-platform/) can host the demo.

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
