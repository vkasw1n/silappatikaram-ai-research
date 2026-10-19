from fastapi import APIRouter, HTTPException

try:
    from ..application.rag_service import get_rag_service
except ImportError:
    from application.rag_service import get_rag_service

router = APIRouter()


@router.post("/run")
def run_evaluation():
    queries = [("Kovalan anklet", {"MAT_010"}), ("Kovalan execution", {"MAT_006"}), ("கண்ணகி", {"MAT_010"})]
    try:
        service = get_rag_service()
        rows = []
        for query, expected in queries:
            result = service.query(query, top_k=5)
            retrieved = [item["passage_id"] for item in result["evidence"]]
            hits = [index + 1 for index, passage_id in enumerate(retrieved) if passage_id in expected]
            rows.append({"query": query, "retrieved": retrieved, "hit": bool(hits), "reciprocal_rank": 1 / hits[0] if hits else 0, "precision": len(set(retrieved) & expected) / max(1, len(retrieved))})
        return {"dataset": "Silappatikāram", "documents": len(service.index.passages), "queries": rows, "metrics": {"recall_at_5": sum(row["hit"] for row in rows) / len(rows), "precision_at_5": sum(row["precision"] for row in rows) / len(rows), "mrr": sum(row["reciprocal_rank"] for row in rows) / len(rows), "ndcg_at_5": None, "hit_at_5": sum(row["hit"] for row in rows) / len(rows)}, "status": "complete"}
    except (ValueError, OSError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error