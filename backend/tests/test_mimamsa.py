from fastapi.testclient import TestClient

try:
    from backend.main import app
except ModuleNotFoundError:
    from main import app


def test_interpretation_is_source_grounded():
    response = TestClient(app).post("/api/interpretation/run", params={"passage_id": "MAT_001"})
    assert response.status_code == 200
    result = response.json()
    item = result["interpretations"][0]
    assert item["passage_id"] == "MAT_001"
    assert item["source_file"]
    assert item["page_start"]
    assert item["method"].startswith("module-3")
    assert item["interpreted_meaning"].startswith("Source-grounded")
    assert item["tatparya"][0]["method"] == "interpretation safeguard"


def test_unknown_passage_is_rejected():
    response = TestClient(app).post("/api/interpretation/run", params={"passage_id": "UNKNOWN"})
    assert response.status_code == 400