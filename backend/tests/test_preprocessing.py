from fastapi.testclient import TestClient

try:
    from backend.main import app
except ModuleNotFoundError:
    from main import app


def test_preprocessing_returns_traceable_records():
    response = TestClient(app).post("/api/preprocessing/run")
    assert response.status_code == 200
    result = response.json()
    assert result["passage_count"] > 0
    assert result["sentence_count"] >= result["passage_count"]
    assert result["entity_count"] > 0
    assert result["processing_version"].startswith("module-2")
    assert result["passages"][0]["passage_id"]
    assert result["passages"][0]["source_file"]
    assert result["capabilities"]["morphology"] == "unavailable"
    assert result["concepts"]
    assert result["parsed_structure"]


def test_preprocessing_does_not_modify_source_dataset():
    response = TestClient(app).post("/api/preprocessing/run")
    assert response.status_code == 200


def test_entered_corpus_can_be_preprocessed():
    corpus = TestClient(app).post("/api/corpus/text", json={"text": "கோவலன் சிலம்பு"}).json()
    response = TestClient(app).post("/api/preprocessing/run", params={"corpus_id": corpus["corpus_id"]})
    assert response.status_code == 200
    assert response.json()["passage_count"] == 1
    assert response.json()["entity_count"] == 0


def test_entered_corpus_is_persisted_on_disk():
    from backend.application.corpus_service import RUNTIME_PATH
    corpus = TestClient(app).post("/api/corpus/text", json={"text": "நிலையான உரை"}).json()
    assert RUNTIME_PATH.is_file()
    assert corpus["corpus_id"] in RUNTIME_PATH.read_text(encoding="utf-8")


def test_parsed_structure_preserves_all_input_words():
    text = "ஒன்று இரண்டு மூன்று நான்கு ஐந்து ஆறு ஏழு எட்டு ஒன்பது பத்து பதினொன்று பன்னிரண்டு பதின்மூன்று"
    corpus = TestClient(app).post("/api/corpus/text", json={"text": text}).json()
    result = TestClient(app).post("/api/preprocessing/run", params={"corpus_id": corpus["corpus_id"]}).json()
    assert [token["text"] for token in result["parsed_structure"][0]["tokens"]] == text.split()