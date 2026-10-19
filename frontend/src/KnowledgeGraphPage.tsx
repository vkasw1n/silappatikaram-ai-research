import { useEffect, useState, useCallback } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Network, RefreshCw, Sparkles, CheckCircle2 } from "lucide-react";
import KnowledgeGraphViewer, { extractNodeId } from "./KnowledgeGraphViewer";
import { translate, type Language } from "./i18n";

type AnyRecord = Record<string, any>;

interface GraphData {
  nodes: AnyRecord[];
  relationships: AnyRecord[];
  backend: string;
  validation?: {
    node_count?: number;
    relationship_count?: number;
    valid?: boolean;
  };
  matched_node_ids?: string[];
  search_query?: string;
}

interface Props {
  initialQuery: string;
  initialContext?: string;
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
  onBack: () => void;
  language: Language;
}

const PRESET_QUERIES = [
  { label: "Kōvalan (கோவலன்)", query: "Kovalan" },
  { label: "Kaṇṇaki (கண்ணகி)", query: "Kannaki" },
  { label: "Mātavi (மாதவி)", query: "Madhavi" },
  { label: "Madurai City (மதுரை)", query: "Madurai" },
  { label: "Pukār (புகார்)", query: "Pukar" },
  { label: "Anklet / Silambu (சிலம்பு)", query: "Silambu" },
];

export default function KnowledgeGraphPage({ initialQuery, initialContext = "", api, onBack, language }: Props) {
  const t = (key: string) => translate(language, key);
  const [query, setQuery] = useState(initialQuery || "");
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hops, setHops] = useState<1 | 2>(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isExpanding, setIsExpanding] = useState(false);

  const search = useCallback(
    async (searchQuery?: string, nextHops: 1 | 2 = hops) => {
      const targetQuery = searchQuery !== undefined ? searchQuery : query;
      const clean = targetQuery.trim();
      if (!clean) {
        setError("Enter a name or phrase to search the validated graph.");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const graphQuery = `${clean}\n${initialContext.slice(0, 350)}`.slice(0, 500);
        const result = await api<GraphData>(
          `/api/graph/search?q=${encodeURIComponent(graphQuery)}&hops=${nextHops}`
        );
        setData(result);
        setSelectedNodeId(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The graph could not be loaded from backend.");
      } finally {
        setLoading(false);
      }
    },
    [api, hops, initialContext, query]
  );

  // Initial load: if query is provided use it, otherwise default to "Kovalan" so the graph is never blank
  useEffect(() => {
    if (initialQuery.trim()) {
      void search(initialQuery, hops);
    } else {
      setQuery("Kovalan");
      void search("Kovalan", hops);
    }
  }, []);

  const handleFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    void search(query, hops);
  };

  const handleHopChange = (nextHops: 1 | 2) => {
    setHops(nextHops);
    void search(query, nextHops);
  };

  const handlePresetClick = (presetQuery: string) => {
    setQuery(presetQuery);
    void search(presetQuery, hops);
  };

  // Expand neighborhood dynamically around selected node
  const handleExpandNeighborhood = async (nodeId: string) => {
    if (!nodeId) return;
    setIsExpanding(true);
    try {
      const result = await api<GraphData>(`/api/graph/subgraph/${encodeURIComponent(nodeId)}`);
      if (result && result.nodes) {
        setData((prev) => {
          if (!prev) return result;
          const existingNodeIds = new Set(prev.nodes.map((n) => extractNodeId(n)));
          const newNodes = result.nodes.filter((n) => !existingNodeIds.has(extractNodeId(n)));

          const existingEdgeIds = new Set(
            prev.relationships.map((e) => String(e.relationship_id || e.id))
          );
          const newEdges = result.relationships.filter(
            (e) => !existingEdgeIds.has(String(e.relationship_id || e.id))
          );

          return {
            ...prev,
            nodes: [...prev.nodes, ...newNodes],
            relationships: [...prev.relationships, ...newEdges],
          };
        });
      }
    } catch (err) {
      console.warn("Subgraph expansion error:", err);
    } finally {
      setIsExpanding(false);
    }
  };

  return (
    <main className="kg-page-container">
      {/* Top Header */}
      <header className="kg-page-header">
        <div className="kg-header-brand">
          <button type="button" className="kg-back-btn" onClick={onBack}>
            <ArrowLeft style={{ width: 15, height: 15 }} />
            <span>{t("backToWorkflow")}</span>
          </button>
          <div className="kg-header-titles">
            <div className="kg-header-eyebrow">
              <span>Silappatikāram Research · Epistemic Knowledge Graph</span>
              <span className="kg-status-badge online">
                <CheckCircle2 style={{ width: 11, height: 11 }} />
                <span>{data?.backend === "neo4j" ? "Neo4j Aura" : "Validated Source Graph"}</span>
              </span>
            </div>
            <h1>{t("graphExplorer")}</h1>
          </div>
        </div>

        {/* Search Bar */}
        <form className="kg-search-bar" onSubmit={handleFormSubmit}>
          <label className="visually-hidden" htmlFor="graph-query">
            Search canonical graph
          </label>
          <input
            id="graph-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
          />
          <button type="submit" disabled={loading}>
            {loading ? t("working") : t("search")}
          </button>
        </form>
      </header>

      {/* Quick Search Strip */}
      <div className="kg-quick-strip">
        <div className="kg-quick-pills">
          <span className="kg-quick-label">
            <Sparkles style={{ width: 14, height: 14, color: "#f59e0b" }} />
            <span>{t("quickSearches")}:</span>
          </span>
          {PRESET_QUERIES.map((p) => (
            <button
              key={p.query}
              type="button"
              onClick={() => handlePresetClick(p.query)}
              className="kg-quick-btn"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="graph-message" style={{ margin: "10px 0" }} role="alert">
          <span>{error}</span>
            <button type="button" onClick={() => void search(query, hops)}>
            {t("retrySearch")}
          </button>
        </div>
      )}

      {/* Main Knowledge Graph Viewer */}
      <KnowledgeGraphViewer
        nodes={data?.nodes || []}
        relationships={data?.relationships || []}
        backend={data?.backend || "csv"}
        selectedNodeId={selectedNodeId}
        onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
        onExpandNeighborhood={handleExpandNeighborhood}
        isExpanding={isExpanding}
        hopDepth={hops}
        onChangeHopDepth={handleHopChange}
        activeQueryString={query || initialQuery}
      />
    </main>
  );
}