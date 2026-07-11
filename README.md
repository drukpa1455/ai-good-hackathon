# AI for Good Hackathon

Public concept and build workspace for **AI for Social Good: Hack with MLH & DigitalOcean**, listed on the [Major League Hacking 2027 season schedule](https://www.mlh.com/seasons/2027/events) for July 10–11, 2026 in San Francisco.

## Status

Concept selection only. No final product, application, model, or third-party dataset has been published here.

The current lead is an independently branded San Francisco community site context graph: deterministic tools reconcile official parcel, assessor, permit, planning, hazard, and neighborhood evidence into a source-backed graph; [DigitalOcean Inference](https://docs.digitalocean.com/products/inference/) explains bounded context subgraphs without becoming the source of facts or making legal, safety, valuation, or buy/sell claims.

See [ideas.md](ideas.md) for the current shortlist and go/no-go criteria, [resources.md](resources.md) for links collected at the kickoff, and the [frontend design handoff](docs/frontend-design-handoff.md) for the mock-first UI contract.

## Candidate Public Sources

San Francisco sources under consideration:

- [Assessor Historical Secured Property Tax Rolls](https://data.sfgov.org/Housing-and-Buildings/Assessor-Historical-Secured-Property-Tax-Rolls/wv5m-vpq2/about_data)
- [Building Permits](https://data.sfgov.org/Housing-and-Buildings/Building-Permits/i98e-djp9/about_data)
- [San Francisco Development Pipeline](https://data.sfgov.org/Housing-and-Buildings/San-Francisco-Development-Pipeline/6jgi-cpb4/about_data)
- [Parcels — Active and Retired](https://data.sfgov.org/Geographic-Locations-and-Boundaries/Parcels-Active-and-Retired/acdm-wktn/about_data)
- [Affordable Housing Bonus Program eligible parcels](https://data.sfgov.org/d/fizh-zaxt)
- [100-Year Storm Flood Risk Zone](https://data.sfgov.org/d/jzu3-4yxp)
- [311 Cases](https://data.sfgov.org/City-Infrastructure/311-Cases/vw6y-z8j6/about_data)

Candidate 3D sources:

- [2023 USGS LiDAR: San Francisco](https://www.fisheries.noaa.gov/inport/item/73386), distributed through USGS and documented by NOAA
- [San Francisco 3D Buildings](https://www.arcgis.com/home/item.html?id=d3344ba99c3f4efaa909ccfbcc052ed5), an Esri scene layer credited to Precision Light Works
- [Google Photorealistic 3D Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles)
- [Aerometrex San Francisco 2 cm model](https://aerometrex.com/models/san-francisco-3d-model-2cm/)

## Platform Direction

The intended DigitalOcean demo path is:

1. preload bounded DataSF source snapshots into a canonical context graph
2. traverse a property-centered context subgraph deterministically
3. combine graph retrieval with managed knowledge-base retrieval
4. let a DigitalOcean agent explain the combined context with source citations
5. evaluate grounding, citation coverage, numeric fidelity, and refusal behavior
6. deploy the interactive map, graph, evidence viewer, and chat through [DigitalOcean App Platform](https://docs.digitalocean.com/products/app-platform/)

No paid API, cloud resource, or deployment is authorized merely by its mention here.

## Attribution and Data Boundaries

Major League Hacking and DigitalOcean names and marks belong to their respective owners. This independent participant repository is not an official event repository.

No third-party dataset, imagery, point cloud, or 3D payload is currently vendored here. Links do not grant redistribution rights. Before any source is copied, transformed, or published, its current license, attribution, access, privacy, and derived-work terms must be recorded and followed. In particular, the Esri scene layer requires Precision Light Works credit and Esri terms; Google tiles require a billing-enabled API key, displayed attribution, and compliance with Google Maps Platform terms; Aerometrex data is commercial.

Do not commit credentials, private records, provider payloads, or downloaded source data. Use bounded public projections and tracked provenance only.

## License

No project license has been selected yet. A software and content license will be chosen before a code release.
