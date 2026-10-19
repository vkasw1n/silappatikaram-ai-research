from fastapi.testclient import TestClient

try:
    from backend.main import app
except ModuleNotFoundError:
    from main import app


def test_entered_text_reaches_interpretation_and_formula_stages():
    client = TestClient(app)
    corpus = client.post("/api/corpus/text", json={"text": "கோவலன் சிலம்பு மதுரை"}).json()
    passage_id = f"{corpus['corpus_id']}:P001"
    interpretation = client.post("/api/interpretation/run", params={"passage_id": passage_id})
    assert interpretation.status_code == 200
    assert interpretation.json()["interpretations"][0]["passage_id"] == passage_id
    propositions = client.post("/api/propositions/generate", params={"passage_id": passage_id})
    assert propositions.status_code == 200
    assert propositions.json()["proposition_count"] == 0