import os
import time
import uuid
import json
import urllib.error
import urllib.request
import logging
from functools import lru_cache
from typing import Any

try:
    from .graph_service import GraphRepository, Neo4jService
    from .rag_index import RAGIndex, tokens
except ImportError:
    from application.graph_service import GraphRepository, Neo4jService
    from application.rag_index import RAGIndex, tokens

RAG_VERSION = "module-6-hybrid-evidence-2.0"
logger = logging.getLogger(__name__)


def _number(name: str, default: int, maximum: int) -> int:
    try:
        return max(1, min(maximum, int(os.getenv(name, str(default)))))
    except ValueError:
        return default


@lru_cache(maxsize=1)
def get_rag_service() -> "RAGService":
    return RAGService()


class RAGService:
    def __init__(self) -> None:
        self.index = RAGIndex()
        self.csv_graph = GraphRepository()
        self.neo4j = Neo4jService()
        self.cache: dict[str, tuple[float, dict[str, Any]]] = {}
        # Pre-index graph nodes by term for instant O(1) lookup
        self._node_term_map: dict[str, list[dict[str, Any]]] = {}
        for node in self.csv_graph.nodes:
            name_str = " ".join((node.get("name_english", ""), node.get("name_tamil", "")))
            for term in set(tokens(name_str)):
                self._node_term_map.setdefault(term, []).append(node)

    @staticmethod
    def _generate_answer(query: str, evidence: list[dict[str, Any]]) -> tuple[str, str]:
        if not evidence:
            return "No relevant passages were retrieved for this question. No answer was generated.", "evidence_only_fallback"
        endpoint = os.getenv("RAG_LLM_API_URL")
        model = os.getenv("RAG_LLM_MODEL")
        if not endpoint or not model:
            return (
                f"No LLM is configured, so no generated conclusion is asserted for “{query}”. "
                "The retrieved source passages below are the evidence available for review.",
                "evidence_only_fallback",
            )

        passages = "\n\n".join(
            f"[{item['evidence_id']}] {item['passage_id']} | {item['kandam']} | "
            f"{item['source_file']} pp. {item['page_start']}-{item['page_end']}\n{item['passage_text']}\n"
            f"Graph provenance: {json.dumps(item['provenance'], ensure_ascii=False)}"
            for item in evidence
        )
        payload = json.dumps({
            "model": model,
            "temperature": 0,
            "max_completion_tokens": 1200,
            "messages": [
                {"role": "system", "content": "You are an evidence-grounded literary research assistant. Answer only from the supplied Silappatikāram passages and graph provenance. Do not use outside knowledge, invent quotations, or convert an implication into a stated fact. Distinguish direct evidence from cautious interpretation. Keep the answer concise: at most 160 words. Use exactly this Markdown structure:\n\n**Summary**\nOne or two sentences answering the question.\n\n**Evidence**\n- [E1] passage ID | source file pp. pages: one precise evidence statement.\n- [E2] passage ID | source file pp. pages: one precise evidence statement.\n\n**Limitations**\nState what the supplied evidence does not establish, or write `None stated.` Do not repeat the summary. Cite every factual statement with the supplied evidence ID. Use only evidence IDs that exist."},
                {"role": "user", "content": f"Question: {query}\n\nRetrieved evidence:\n{passages}"},
            ],
        }).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Silappatikaram-RAG/1.0",
        }
        api_key = os.getenv("RAG_LLM_API_KEY")
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        request = urllib.request.Request(endpoint, data=payload, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                result = json.loads(response.read().decode("utf-8"))
            answer = result["choices"][0]["message"]["content"].strip()
            if not answer:
                raise ValueError("The configured LLM returned an empty answer")
            return answer, "llm"
        except (OSError, ValueError, KeyError, IndexError, TypeError, urllib.error.URLError) as error:
            logger.warning("Configured RAG LLM request failed: %s: %s", type(error).__name__, str(error)[:240])
            if not evidence:
                return "The configured LLM is unavailable and no relevant passages were retrieved. No answer was generated.", "evidence_only_fallback"
            return (
                f"The configured LLM is unavailable, so no generated conclusion is asserted for “{query}”. "
                "The retrieved source passages below are the evidence available for review.",
                "evidence_only_fallback",
            )

    def _understand(self, query: str) -> dict[str, Any]:
        query_terms = set(tokens(query))
        matched_nodes: dict[str, dict[str, Any]] = {}
        for term in query_terms:
            for node in self._node_term_map.get(term, []):
                matched_nodes[node["node_id"]] = node

        entities = []
        events = []
        for node in matched_nodes.values():
            item = {"node_id": node["node_id"], "name": node["name_english"] or node["name_tamil"], "source": "graph_node_name"}
            if node.get("node_type") == "ENTITY":
                entities.append(item)
            elif node.get("node_type") == "EVENT":
                events.append(item)

        return {"intent": "evidence_retrieval", "entities": entities, "events": events, "keywords": sorted(query_terms)}

    def _graph_retrieve(self, understanding: dict[str, Any]) -> tuple[list[dict[str, Any]], str]:
        edges: dict[str, dict[str, Any]] = {}
        backend = "csv_fallback"
        for item in understanding["entities"] + understanding["events"]:
            graph_result = None
            if self.neo4j.enabled():
                try:
                    graph_result = self.neo4j.query_subgraph(item["node_id"])
                    backend = "neo4j"
                except Exception:
                    graph_result = None
            if graph_result is None:
                graph_result = self.csv_graph.subgraph(item["node_id"])
            for edge in graph_result["relationships"]:
                edges[edge["relationship_id"]] = edge
        return list(edges.values()), backend

    @staticmethod
    def _rrf(rank: int, constant: int) -> float:
        # Reciprocal Rank Fusion: RRF(d) = sum_i 1 / (k + rank_i(d)).
        return 1.0 / (constant + rank)

    def query(self, query: str, top_k: int = 5, filters: dict[str, str] | None = None, use_dense: bool = True, use_bm25: bool = True, use_graph: bool = True, use_reranker: bool = True, context: str | None = None) -> dict[str, Any]:
        started = time.perf_counter()
        query = query.strip()
        if not query:
            raise ValueError("query must not be empty")
        if len(query) > 5000:
            raise ValueError("query must be 5000 characters or fewer")
        context = (context or "").strip()
        if len(context) > 10_000_000:
            raise ValueError("context must be 10,000,000 characters or fewer")
        retrieval_query = f"{query}\n{context[:5000]}" if context else query
        if not 1 <= top_k <= 50:
            raise ValueError("top_k must be between 1 and 50")
        filters = filters or {}
        cache_key = repr((query.casefold(), context[:5000].casefold(), top_k, sorted(filters.items()), use_dense, use_bm25, use_graph, use_reranker, self.index.metadata.get("index_version"), self.index.model_name))
        cached = self.cache.get(cache_key)
        if cached and cached[0] > time.time():
            result = dict(cached[1])
            result["retrieval_metadata"] = dict(result["retrieval_metadata"])
            result["retrieval_metadata"]["cache_hit"] = True
            return result

        understanding = self._understand(retrieval_query)
        graph_edges, graph_backend = self._graph_retrieve(understanding) if use_graph else ([], "disabled")
        graph_by_passage: dict[str, list[dict[str, Any]]] = {}
        for edge in graph_edges:
            if edge.get("passage_id"):
                graph_by_passage.setdefault(edge["passage_id"], []).append(edge)
        candidate_limit = _number("RAG_CANDIDATE_TOP_K", 20, 100)
        bm25_results = self.index.bm25.search(retrieval_query, candidate_limit) if use_bm25 else []
        dense_results = self.index.embedding_provider.search(retrieval_query, self.index.vectors, candidate_limit) if use_dense else []
        candidate_ids = {self.index.passages[index]["passage_id"] for index, _ in bm25_results + dense_results}
        candidate_ids |= set(graph_by_passage)
        try:
            dense_minimum = float(os.getenv("RAG_MIN_DENSE_SCORE", "0.30"))
        except ValueError:
            dense_minimum = 0.30
        dense_minimum = max(-1.0, min(1.0, dense_minimum))
        bm25_ids = {self.index.passages[index]["passage_id"] for index, score in bm25_results if score > 0}
        dense_scores = {self.index.passages[index]["passage_id"]: score for index, score in dense_results}
        candidate_ids = {
            passage_id for passage_id in candidate_ids
            if passage_id in bm25_ids or passage_id in graph_by_passage
            or dense_scores.get(passage_id, 0.0) >= dense_minimum
        }
        by_id = {row["passage_id"]: row for row in self.index.passages}
        candidate_ids = {passage_id for passage_id in candidate_ids if passage_id in by_id and all(not filters.get(key) or by_id[passage_id].get(key) == value for key, value in filters.items())}
        bm25_rank = {self.index.passages[index]["passage_id"]: (rank, score) for rank, (index, score) in enumerate(bm25_results, start=1)}
        dense_rank = {self.index.passages[index]["passage_id"]: (rank, score) for rank, (index, score) in enumerate(dense_results, start=1)}
        graph_ranked = sorted(((passage_id, len(edges)) for passage_id, edges in graph_by_passage.items()), key=lambda item: (-item[1], item[0]))[:candidate_limit]
        graph_rank = {passage_id: (rank, float(score)) for rank, (passage_id, score) in enumerate(graph_ranked, start=1)}
        rrf_constant = _number("RAG_RRF_K", 60, 1000)
        weights = {"dense": 0.4, "bm25": 0.3, "graph": 0.3}
        fused = []
        for passage_id in candidate_ids:
            rrf_score = sum(weights[name] * self._rrf(rank_data[0], rrf_constant) for name, rank_data in (("dense", dense_rank.get(passage_id)), ("bm25", bm25_rank.get(passage_id)), ("graph", graph_rank.get(passage_id))) if rank_data)
            fused.append((rrf_score, passage_id))
        fused.sort(key=lambda item: (-item[0], item[1]))
        rerank_candidates = fused[:_number("RAG_RERANK_TOP_K", 20, 100)]
        query_terms = set(tokens(retrieval_query))
        reranked = []
        for rrf_score, passage_id in rerank_candidates:
            passage = by_id[passage_id]
            overlap = len(query_terms & set(tokens(passage["passage_text"]))) / max(1, len(query_terms))
            reranker_score = overlap if use_reranker else rrf_score
            final_score = 0.7 * rrf_score + 0.3 * reranker_score if use_reranker else rrf_score
            reranked.append((final_score, rrf_score, reranker_score, passage_id))
        reranked.sort(key=lambda item: (-item[0], item[3]))
        evidence = []
        best_final_score = reranked[0][0] if reranked else 0.0
        for number, (final_score, rrf_score, reranker_score, passage_id) in enumerate(reranked[:top_k], start=1):
            passage = by_id[passage_id]
            edges = graph_by_passage.get(passage_id, [])
            matched_entities = sorted({item["node_id"] for item in understanding["entities"] if any(item["node_id"] in (edge.get("source_id"), edge.get("target_id")) for edge in edges)})
            matched_events = sorted({item["node_id"] for item in understanding["events"] if any(item["node_id"] in (edge.get("source_id"), edge.get("target_id")) for edge in edges)})
            evidence.append({
                "evidence_id": f"E{number}", "passage_id": passage_id, "passage_text": passage["passage_text"], "kandam": passage["kandam"], "section_number": passage["section_number"], "section_name": passage["section_name"], "source_file": passage["source_file"], "page_start": passage["page_start"], "page_end": passage["page_end"],
                "retrieval_method": "dense+bm25+graph+reranker" if use_reranker else "dense+bm25+graph", "retrieval_methods": [name for name, enabled in (("dense", bool(dense_results)), ("bm25", use_bm25), ("graph", use_graph and bool(edges)), ("reranker", use_reranker)) if enabled],
                "dense_score": round(dense_rank.get(passage_id, (0, 0.0))[1], 4), "bm25_score": round(bm25_rank.get(passage_id, (0, 0.0))[1], 4), "graph_score": round(min(1.0, graph_rank.get(passage_id, (0, 0.0))[1] / 3), 4), "rrf_score": round(rrf_score, 6), "reranker_score": round(reranker_score, 4), "final_score": round(final_score, 6), "relevance_score": round(final_score / best_final_score, 4) if best_final_score else 0.0,
                "matched_entities": matched_entities, "matched_events": matched_events, "matched_relationships": [edge["relationship_id"] for edge in edges], "graph_backend": graph_backend, "provenance": [{"relationship_id": edge["relationship_id"], "relationship_type": edge["relationship_type"], "evidence": edge["evidence"], "source_file": edge["source_file"], "source_page_start": edge["source_page_start"], "source_page_end": edge["source_page_end"]} for edge in edges], "source_dataset": "data/processed/passages.csv", "source_pdf": passage["source_file"], "source_pages": f"{passage['page_start']}-{passage['page_end']}",
            })
        metadata = {"request_id": str(uuid.uuid4()), "status": "SUCCESS" if evidence else "no_relevant_evidence", "candidate_count": len(candidate_ids), "unique_passages": len(candidate_ids), "final_evidence_count": len(evidence), "retrieval_methods": sorted({method for item in evidence for method in item["retrieval_methods"]}), "dense_enabled": bool(dense_results), "bm25_enabled": use_bm25, "graph_enabled": use_graph, "graph_backend": graph_backend, "reranker_enabled": use_reranker, "reranker_model": "local lexical overlap fallback" if use_reranker else "disabled", "embedding_model": self.index.model_name, "index_version": self.index.metadata.get("index_version"), "index_stale": self.index.metadata.get("stale", True), "context_used": bool(context), "context_characters": len(context), "context_retrieval_truncated": len(context) > 5000, "latency_ms": round((time.perf_counter() - started) * 1000, 2), "cache_hit": False}
        answer, answer_mode = self._generate_answer(query, evidence)
        llm_configured = bool(os.getenv("RAG_LLM_API_URL") and os.getenv("RAG_LLM_MODEL"))
        metadata["llm_configured"] = llm_configured
        metadata["llm_active"] = answer_mode == "llm"
        result = {"query": query, "conclusion": answer if answer_mode == "llm" else None, "answer": answer, "answer_mode": answer_mode, "entities": understanding["entities"], "events": understanding["events"], "graph_paths": graph_edges, "documents": [{"passage_id": item["passage_id"], "source_file": item["source_file"], "page_start": item["page_start"], "page_end": item["page_end"]} for item in evidence], "evidence": evidence, "retrieval_metadata": metadata, "weights": weights, "processing_version": RAG_VERSION, "status": "SUCCESS" if evidence else "INSUFFICIENT_EVIDENCE"}
        ttl = max(0, int(os.getenv("RAG_CACHE_TTL_SECONDS", "300")))
        if ttl and (answer_mode == "llm" or not llm_configured):
            self.cache[cache_key] = (time.time() + ttl, result)
        return result
