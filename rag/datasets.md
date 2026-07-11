# DataSF source definitions and licenses

Groundwork SF compiles bounded projections from seven City and County of San
Francisco open-data datasets. This catalog defines what each source can support;
it does not contain site-specific records.

License and publishing metadata below come from each dataset's official DataSF
metadata record. The compiler must preserve the dataset identifier, source URL,
license identifier, retrieval time, available source-update time, bounded query,
and artifact hash in provenance.

| Dataset | Intended graph role | Publishing metadata | License |
| --- | --- | --- | --- |
| [Parcels – Active and Retired (`acdm-wktn`)](https://data.sfgov.org/d/acdm-wktn) | Canonical block/lot identity and parcel geometry | Daily; Department of Technology | [PDDL 1.0](https://opendatacommons.org/licenses/pddl/1-0/) |
| [Building Permits (`i98e-djp9`)](https://data.sfgov.org/d/i98e-djp9) | Permit records, types, statuses, descriptions, and status dates | Daily publishing; changes multiple times per hour; Department of Building Inspection | [PDDL 1.0](https://opendatacommons.org/licenses/pddl/1-0/) |
| [San Francisco Development Pipeline (`6jgi-cpb4`)](https://data.sfgov.org/d/6jgi-cpb4) | Project descriptions, unit counts, affordable-unit counts, pipeline status, and best-known status date | Quarterly publishing; changes as needed; Planning Department | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [Assessor Historical Secured Property Tax Rolls (`wv5m-vpq2`)](https://data.sfgov.org/d/wv5m-vpq2) | Annual assessment history grouped into a series | Annual; Office of the Assessor-Recorder | [PDDL 1.0](https://opendatacommons.org/licenses/pddl/1-0/) |
| [Affordable Housing Bonus Program eligible parcels (`fizh-zaxt`)](https://data.sfgov.org/d/fizh-zaxt) | Historical match against the published eligibility layer | As needed; Planning Department | [PDDL 1.0](https://opendatacommons.org/licenses/pddl/1-0/) |
| [100-Year Storm Flood Risk Zone, July 2022 (`jzu3-4yxp`)](https://data.sfgov.org/d/jzu3-4yxp) | Geometry comparison against the dated flood-risk layer | As needed; SFPUC / Office of Resilience and Capital Planning | [PDDL 1.0](https://opendatacommons.org/licenses/pddl/1-0/) |
| [311 Cases (`vw6y-z8j6`)](https://data.sfgov.org/d/vw6y-z8j6) | Time-bounded, proximity-based neighborhood aggregates | Daily publishing; changes multiple times per hour; San Francisco 311 | [PDDL 1.0](https://opendatacommons.org/licenses/pddl/1-0/) |

## Query boundaries

- Parcel-bound sources use a validated seven-digit APN and a fixed field list.
- The compiler fetches no more than one bounded projection per registered
  dataset during a refresh.
- 311 is aggregated server-side for a declared radius and time window. Individual
  case notes, descriptions, personal information, and media are not retrieved.
- Annual or quarterly records remain annual or quarterly evidence. The compiler
  does not relabel them as real-time facts.
- A spatial comparison says only what the compiled assertion states. Evaluation
  against a layer is not automatically an intersection, risk, or safety finding.

## Interpretation limits

Dataset presence does not prove completeness. A query returning no row is a
coverage gap unless the source contract explicitly supports a negative claim.
Program and hazard layers retain their vintages. Permit and pipeline records may
describe different processes or observation times and must not be silently
collapsed into a single status.

PDDL and CC0 permit broad reuse under their terms, but a license does not make a
dataset current, complete, private, or suitable for a decision. Answers should
retain City attribution and link to the packet-provided DataSF record.
