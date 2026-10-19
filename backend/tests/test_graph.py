from fastapi.testclient import TestClient

try:
    from backend.main import app
except ModuleNotFoundError:
    from main import app


def test_graph_export_integrity():
    response = TestClient(app).get("/api/graph/search", params={"q": "Kovalan"})
    assert response.status_code == 200
    result = response.json()
    assert result["validation"]["valid"] is True
    assert result["validation"]["node_count"] == 96
    assert result["validation"]["relationship_count"] == 354
    assert "ENT_KOVALAN" in result["matched_node_ids"]


def test_entity_subgraph_preserves_provenance():
    response = TestClient(app).get("/api/graph/entity/ENT_KOVALAN")
    assert response.status_code == 200
    result = response.json()
    assert result["nodes"]
    assert result["relationships"]
    edge = result["relationships"][0]
    assert edge["relationship_id"]
    assert edge["passage_id"]
    assert edge["source_file"]
    assert edge["source_page_start"]


def test_unknown_graph_node_is_rejected():
    response = TestClient(app).get("/api/graph/entity/UNKNOWN")
    assert response.status_code == 404


def test_empty_graph_search_is_rejected():
    response = TestClient(app).get("/api/graph/search", params={"q": " "})
    assert response.status_code == 400


def test_graph_status_reports_csv_fallback_without_credentials(monkeypatch):
    monkeypatch.delenv("NEO4J_URI", raising=False)
    monkeypatch.delenv("NEO4J_PASSWORD", raising=False)
    response = TestClient(app).get("/api/graph/status")
    assert response.status_code == 200
    assert response.json()["backend"] == "csv_fallback"
    assert response.json()["connected"] is False


def test_multi_word_graph_search_returns_focused_matches():
    response = TestClient(app).get("/api/graph/search", params={"q": "Kovalan anklet"})
    assert response.status_code == 200
    result = response.json()
    assert "ENT_KOVALAN" in result["matched_node_ids"]
    assert len(result["matched_node_ids"]) <= 8


def test_two_hop_graph_search_expands_validated_neighborhood():
    client = TestClient(app)
    one_hop = client.get("/api/graph/search", params={"q": "Kovalan", "hops": 1}).json()
    two_hops = client.get("/api/graph/search", params={"q": "Kovalan", "hops": 2}).json()
    assert len(two_hops["nodes"]) >= len(one_hop["nodes"])
    assert len(two_hops["relationships"]) >= len(one_hop["relationships"])