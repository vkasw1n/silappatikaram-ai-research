from fastapi.testclient import TestClient

try:
    from backend.main import app
except ModuleNotFoundError:
    from main import app


def test_evaluation_api_returns_measured_results():
    response = TestClient(app).post("/api/evaluation/run")
    assert response.status_code == 200
    result = response.json()
    assert result["documents"] == 30
    assert result["status"] == "complete"
    assert result["metrics"]["recall_at_5"] is not None
    assert result["metrics"]["ndcg_at_5"] is None