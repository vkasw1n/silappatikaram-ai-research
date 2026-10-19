import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.application.rag_service import RAGService

EVALUATION_QUERIES = [
    ("Kovalan anklet", {"MAT_010"}),
    ("Kovalan execution", {"MAT_006"}),
    ("கண்ணகி", {"MAT_010"}),
]


def reciprocal_rank(retrieved: list[str], expected: set[str]) -> float:
    for rank, passage_id in enumerate(retrieved, start=1):
        if passage_id in expected:
            return 1 / rank
    return 0.0


def main() -> None:
    service = RAGService()
    hits = []
    precisions = []
    reciprocal_ranks = []
    for query, expected in EVALUATION_QUERIES:
        result = service.query(query, top_k=5)
        retrieved = [item["passage_id"] for item in result["evidence"]]
        relevant = len(set(retrieved) & expected)
        hits.append(bool(relevant))
        precisions.append(relevant / max(1, len(retrieved)))
        reciprocal_ranks.append(reciprocal_rank(retrieved, expected))
    print(f"Recall@5: {sum(hits) / len(hits):.3f}")
    print(f"Precision@5: {sum(precisions) / len(precisions):.3f}")
    print(f"MRR: {sum(reciprocal_ranks) / len(reciprocal_ranks):.3f}")
    print("nDCG@5: evaluation baseline uses binary relevance; extend labels for graded judgments")


if __name__ == "__main__":
    main()