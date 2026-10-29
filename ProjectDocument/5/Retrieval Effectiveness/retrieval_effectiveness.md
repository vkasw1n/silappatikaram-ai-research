# Retrieval Effectiveness

## Retrieval Effectiveness

Table 4 compares the configurations of Section 4.1 over the query set ($|Q| = 3$, inter-annotator agreement $\kappa = \mathrm{N/A}$). Queries include "Kovalan anklet" and "Kovalan execution" together with the Tamil-language question "கண்ணகி".

| Configuration | Precision@5 | Recall@5 | MRR |
|---|---:|---:|---:|
| BM25 only | 0.067 | 0.333 | 0.333 |
| Dense only | 0.000 | 0.000 | 0.000 |
| Graph only | 0.200 | 1.000 | 1.000 |
| Hybrid without graph ranking | 0.067 | 0.333 | 0.333 |
| Hybrid without dense threshold | 0.200 | 1.000 | 1.000 |
| Hybrid (weighted RRF) | 0.200 | 1.000 | 1.000 |

The weighted Reciprocal Rank Fusion configuration used $k = 60$ and weights $(w_{\mathrm{dense}}, w_{\mathrm{BM25}}, w_{\mathrm{graph}}) = (0.4, 0.3, 0.3)$. The values were measured over the three-query evaluation set with top-five retrieval and reranking disabled for the ablation comparison.

## 5.4 Evidence Traceability

Over the same queries, citation resolution is **1.000 (15/15)** and provenance completeness is **1.000 (15/15)**, using structural resolution checks on the returned evidence. Every returned item contained a valid passage ID, source file, and page range, and every returned item contained non-empty graph provenance. Abstention correctness is **N/A**, because the prototype has no labelled answerable or unanswerable queries. Inter-annotator agreement remains **N/A** because no independent second annotation set is available.

## Measurement Notes

- $|Q| = 3$: "Kovalan anklet", "Kovalan execution", and "கண்ணகி".
- Precision@5, Recall@5, and MRR are averaged across the three queries.
- The default dense score threshold is 0.30.
- "Hybrid without dense threshold" was measured with the dense threshold disabled.
- The evaluation source is `scripts/evaluate_rag.py`; the ablation values were measured directly with the retrieval service.
- Traceability counts use 15 evidence items: five returned for each of the three evaluation queries.
- Citation resolution and provenance completeness are structural proxy measurements, not human-annotated citation correctness.
