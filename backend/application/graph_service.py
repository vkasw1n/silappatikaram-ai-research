import csv
import os
from pathlib import Path
from typing import Any

try:
    from .preprocessing_service import _dataset_path
except ImportError:
    from application.preprocessing_service import _dataset_path

ALLOWED_RELATIONSHIP_TYPES = {
    "MENTIONED_IN", "OCCURS_IN", "PARTICIPATES_IN", "SUBJECT_OF",
    "LOCATION_OF", "DESTINATION_OF", "PRESENTS_EVIDENCE", "MENTIONED_IN_EVENT",
    "TARGET_OF",
}
NODE_COLUMNS = {
    "node_id", "node_type", "name_tamil", "name_english", "entity_type",
    "kandam", "section_number", "section_name", "event_type",
    "event_name_tamil", "event_name_english", "description", "source_file",
    "source_page_start", "source_page_end",
}
RELATIONSHIP_COLUMNS = {
    ":START_ID", ":END_ID", ":TYPE", "relationship_id", "source_type",
    "target_type", "passage_id", "event_id", "evidence", "confidence",
    "source_file", "source_page_start", "source_page_end",
}


def _read_csv(filename: str, required: set[str]) -> list[dict[str, str]]:
    path = Path(__file__).resolve().parents[2] / "data" / "neo4j" / filename
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"{filename} is missing columns: {', '.join(sorted(missing))}")
        return list(reader)


class GraphValidationService:
    def validate(self, nodes: list[dict[str, str]], relationships: list[dict[str, str]]) -> dict[str, Any]:
        node_ids = [row["node_id"] for row in nodes]
        node_counts: dict[str, int] = {}
        for node_id in node_ids:
            node_counts[node_id] = node_counts.get(node_id, 0) + 1
        duplicate_ids = sorted(node_id for node_id, count in node_counts.items() if count > 1)
        node_set = set(node_ids)
        orphan_relationships = [
            row["relationship_id"] for row in relationships
            if row[":START_ID"] not in node_set or row[":END_ID"] not in node_set
        ]
        invalid_types = sorted({row[":TYPE"] for row in relationships if row[":TYPE"] not in ALLOWED_RELATIONSHIP_TYPES})
        relationship_counts: dict[str, int] = {}
        for row in relationships:
            relationship_id = row["relationship_id"]
            if relationship_id:
                relationship_counts[relationship_id] = relationship_counts.get(relationship_id, 0) + 1
        duplicate_relationships = sorted(relationship_id for relationship_id, count in relationship_counts.items() if count > 1)
        return {
            "valid": not duplicate_ids and not orphan_relationships and not invalid_types and not duplicate_relationships,
            "node_count": len(nodes),
            "relationship_count": len(relationships),
            "duplicate_node_ids": duplicate_ids,
            "orphan_relationships": orphan_relationships,
            "invalid_relationship_types": invalid_types,
            "duplicate_relationship_ids": duplicate_relationships,
        }


class GraphRepository:
    def __init__(self) -> None:
        self.nodes = _read_csv("nodes.csv", NODE_COLUMNS)
        self.relationships = _read_csv("neo4j_relationships.csv", RELATIONSHIP_COLUMNS)
        self.validation = GraphValidationService().validate(self.nodes, self.relationships)
        if not self.validation["valid"]:
            raise ValueError(f"Graph validation failed: {self.validation}")
        self.node_by_id = {row["node_id"]: row for row in self.nodes}

    def _edge(self, row: dict[str, str]) -> dict[str, Any]:
        return {
            "relationship_id": row["relationship_id"],
            "source_id": row[":START_ID"],
            "target_id": row[":END_ID"],
            "relationship_type": row[":TYPE"],
            "passage_id": row["passage_id"],
            "event_id": row["event_id"],
            "evidence": row["evidence"],
            "confidence": row["confidence"],
            "source_file": row["source_file"],
            "source_page_start": row["source_page_start"],
            "source_page_end": row["source_page_end"],
        }

    def _result(self, node_ids: set[str], hops: int = 1) -> dict[str, Any]:
        visited = {node_id for node_id in node_ids if node_id in self.node_by_id}
        frontier = set(visited)
        edge_rows: dict[str, dict[str, str]] = {}
        for _ in range(max(1, min(hops, 2))):
            next_frontier: set[str] = set()
            for row in self.relationships:
                source = row[":START_ID"]
                target = row[":END_ID"]
                if source in frontier or target in frontier:
                    edge_rows[row["relationship_id"]] = row
                    next_frontier.update((source, target))
            frontier = next_frontier - visited
            visited.update(frontier)
            if not frontier:
                break
        edges = [self._edge(row) for row in edge_rows.values()]
        matched_nodes = sorted(node_id for node_id in node_ids if node_id in self.node_by_id)
        related_nodes = sorted(visited - set(matched_nodes))
        nodes = [self.node_by_id[node_id] for node_id in matched_nodes + related_nodes]
        return {"nodes": nodes, "relationships": edges, "validation": self.validation, "backend": "csv"}

    def entity(self, entity_id: str) -> dict[str, Any]:
        if entity_id not in self.node_by_id or self.node_by_id[entity_id]["node_type"] != "ENTITY":
            raise KeyError(entity_id)
        return self._result({entity_id})

    def subgraph(self, node_id: str) -> dict[str, Any]:
        if node_id not in self.node_by_id:
            raise KeyError(node_id)
        return self._result({node_id})

    def passage(self, passage_id: str) -> dict[str, Any]:
        if passage_id not in self.node_by_id or self.node_by_id[passage_id]["node_type"] != "PASSAGE":
            raise KeyError(passage_id)
        return self._result({passage_id})

    def search(self, query: str, hops: int = 1) -> dict[str, Any]:
        needle = query.casefold().strip()
        if not needle:
            raise ValueError("query must not be empty")
        if len(needle) > 500:
            raise ValueError("query must be 500 characters or fewer")
        if hops not in {1, 2}:
            raise ValueError("graph search supports 1 or 2 hops")
        terms = [term for term in needle.split() if len(term) > 1]
        matches = {
            row["node_id"] for row in self.nodes
            if any(term in " ".join((row.get("node_id", ""), row.get("name_tamil", ""), row.get("name_english", ""), row.get("description", ""))).casefold() for term in terms)
        }
        # Keep a multi-word search focused on the strongest direct matches.
        if len(matches) > 8:
            matches = set(sorted(matches)[:8])
        result = self._result(matches, hops)
        result["matched_node_ids"] = sorted(matches)
        result["search_query"] = query
        return result


class Neo4jService:
    """Optional live Neo4j adapter. CSV remains the safe local fallback."""

    def __init__(self) -> None:
        self.uri = os.getenv("NEO4J_URI")
        self.user = os.getenv("NEO4J_USER", "neo4j")
        self.password = os.getenv("NEO4J_PASSWORD")
        self.database = os.getenv("NEO4J_DATABASE", "neo4j")
        self._driver = None

    def enabled(self) -> bool:
        return bool(self.uri and self.password)

    def status(self) -> dict[str, Any]:
        if not self.enabled():
            return {"configured": False, "connected": False, "backend": "csv_fallback", "message": "Set NEO4J_URI and NEO4J_PASSWORD to enable live Neo4j retrieval."}
        try:
            self._get_driver().verify_connectivity()
            return {"configured": True, "connected": True, "backend": "neo4j", "database": self.database, "uri": self.uri}
        except Exception as error:
            return {"configured": True, "connected": False, "backend": "csv_fallback", "database": self.database, "uri": self.uri, "message": str(error)}

    def _get_driver(self):
        if self._driver is None:
            try:
                from neo4j import GraphDatabase
            except ImportError as error:
                raise RuntimeError("Install the neo4j Python driver to use the live adapter") from error
            self._driver = GraphDatabase.driver(self.uri, auth=(self.user, self.password))
        return self._driver

    def query_subgraph(self, node_id: str) -> dict[str, Any]:
        if not self.enabled():
            raise RuntimeError("Neo4j is not configured; use the validated CSV repository")
        with self._get_driver().session(database=self.database) as session:
            records = session.run("MATCH (n:GraphNode {node_id: $node_id})-[r]-(m:GraphNode) RETURN n, r, m", node_id=node_id)
            nodes: dict[str, dict[str, Any]] = {}
            relationships = []
            for record in records:
                for node in (record["n"], record["m"]):
                    nodes[node["node_id"]] = dict(node)
                relationship = record["r"]
                relationships.append({"relationship_id": relationship.get("relationship_id"), "source_id": relationship.start_node["node_id"], "target_id": relationship.end_node["node_id"], "relationship_type": relationship.type, "passage_id": relationship.get("passage_id"), "event_id": relationship.get("event_id"), "evidence": relationship.get("evidence"), "confidence": relationship.get("confidence"), "source_file": relationship.get("source_file"), "source_page_start": relationship.get("source_page_start"), "source_page_end": relationship.get("source_page_end")})
            return {"nodes": list(nodes.values()), "relationships": relationships, "backend": "neo4j"}


def get_repository() -> GraphRepository:
    return GraphRepository()