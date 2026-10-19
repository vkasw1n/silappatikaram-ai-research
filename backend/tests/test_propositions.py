from fastapi.testclient import TestClient

try:
    from backend.main import app
except ModuleNotFoundError:
    from main import app


def test_propositions_are_evidence_only_and_traceable():
    response = TestClient(app).post("/api/propositions/generate", params={"passage_id": "MAT_001"})
    assert response.status_code == 200
    result = response.json()
    assert result["proposition_count"] > 0
    proposition = result["propositions"][0]
    assert proposition["proposition_id"] == "P1"
    assert proposition["type"] == "EVIDENCE"
    assert proposition["source_passage"] == "MAT_001"
    assert proposition["source_file"]
    assert proposition["source_page"]
    assert proposition["evidence_id"]
    assert proposition["evidence"]
    assert result["safety"]["generated_facts"] == 0
    assert result["safety"]["generated_inferences"] == 0


def test_unknown_passage_returns_empty_evidence_set():
    response = TestClient(app).post("/api/propositions/generate", params={"passage_id": "UNKNOWN"})
    assert response.status_code == 200
    assert response.json()["proposition_count"] == 0


def test_custom_passage_propositions_generation():
    client = TestClient(app)
    corpus = client.post("/api/corpus/text", json={"text": "கோவலன் சிலம்பு மதுரை"}).json()
    passage_id = f"{corpus['corpus_id']}:P001"
    response = client.post("/api/propositions/generate", params={"passage_id": passage_id, "include_custom": "true"})
    assert response.status_code == 200
    result = response.json()
    assert result["proposition_count"] > 0
    assert "fol_predicate" in result["propositions"][0]
    assert "formal_formula" in result["propositions"][0]