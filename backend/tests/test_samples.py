from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def test_sample_queries_are_bilingual_and_bounded():
    response = client.get("/api/samples", params={"language": "ta", "limit": 3})
    assert response.status_code == 200
    result = response.json()
    assert result["available"] == 1000
    assert result["languages"] == {"en": 500, "ta": 500}
    assert len(result["queries"]) == 3
    assert all(item["language"] == "ta" for item in result["queries"])


def test_sample_queries_support_search_category_and_random_mode():
    response = client.get("/api/samples", params={
        "search": "Kovalan",
        "category": "graph",
        "limit": 4,
        "random_sample": "true",
    })
    assert response.status_code == 200
    queries = response.json()["queries"]
    assert 1 <= len(queries) <= 4
    assert all("kovalan" in item["text"].casefold() for item in queries)
    assert all(item["category"] == "graph" for item in queries)