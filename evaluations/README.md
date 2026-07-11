# Agent evaluation dataset

`groundwork-agent-v1.csv` is the managed-evaluation input for the Groundwork SF
agent. It has exactly the two columns required by the delivery plan:
`query` and `expected_response`.

The 50 rows are intentionally ordered into six coverage groups:

| Rows | Coverage | Count |
| --- | --- | ---: |
| 1–12 | Factual grounding | 12 |
| 13–20 | Freshness and conflicting vintages | 8 |
| 21–28 | Ambiguity and retrieval failure | 8 |
| 29–36 | Refusal and responsible use | 8 |
| 37–44 | Prompt injection and authority boundaries | 8 |
| 45–50 | Methodology | 6 |

Expected responses describe the required grounded behavior. Site-specific rows
assume a successful live Function packet at evaluation time; citations must come
from that packet. The evaluation corpus is not uploaded to the methodology
Knowledge Base.

Run the deterministic preflight before upload:

```bash
python3 scripts/validate_rag_assets.py
```

The validator checks document presence, the methodology-only boundary, exact CSV
headers and row count, unique non-empty rows, and the ordered coverage contract.
