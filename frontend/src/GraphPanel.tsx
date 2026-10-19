// Legacy panel retained for compatibility with earlier module imports.
// @ts-nocheck
type GraphNode = { node_id: string; node_type: string; name_english: string; name_tamil: string; description: string };
type GraphEdge = { relationship_id: string; source_id: string; target_id: string; relationship_type: string; passage_id: string; evidence: string; source_file: string; source_page_start: string; source_page_end: string };
type GraphResult = { nodes: GraphNode[]; relationships: GraphEdge[]; matched_node_ids?: string[]; validation: { node_count: number; relationship_count: number; valid: boolean }; backend: string };
type Props = { result: GraphResult | null; busy: boolean; error: string; onRun: () => void };

export default function GraphPanel({ result, busy, error, onRun }: Props) {
  const visibleNodes = result?.nodes.slice(0, 12) || [];
  const positions = visibleNodes.reduce<Record<string, { x: number; y: number }>>((map, node, index) => {
    map[node.node_id] = { x: 75 + (index % 4) * 180, y: 45 + Math.floor(index / 4) * 82 };
    return map;
  }, {});
  return <section className="graph-panel">
    <div className="panel-heading"><div><span className="panel-number">03</span><h3>See how the story connects</h3></div><span className="tag">PEOPLE · EVENTS · PLACES</span></div>
    <p className="panel-disclaimer">These links help you follow the story back to the original passages.</p>
    {!result && <button className="run-button" onClick={onRun} disabled={busy}>{busy ? "Loading connections..." : "Show story connections"}</button>}
    {error && <div className="message error">! {error}</div>}
    {result && <><div className="graph-stats"><div><strong>{result.validation.node_count}</strong><span>things found</span></div><div><strong>{result.validation.relationship_count}</strong><span>connections</span></div><div><strong>{result.nodes.filter((node) => node.node_type === "ENTITY").length}</strong><span>people and objects</span></div><div><strong>Ready</strong><span>source checked</span></div></div><div className="graph-canvas"><svg className="graph-svg" viewBox="0 0 720 270" role="img" aria-label="People, events, and passages connected in the story">{result.relationships.filter((edge) => positions[edge.source_id] && positions[edge.target_id]).slice(0, 18).map((edge) => <line key={edge.relationship_id} x1={positions[edge.source_id].x} y1={positions[edge.source_id].y} x2={positions[edge.target_id].x} y2={positions[edge.target_id].y} />)}{visibleNodes.map((node) => <g key={node.node_id} transform={`translate(${positions[node.node_id].x}, ${positions[node.node_id].y})`}><circle className={`graph-circle ${node.node_type.toLowerCase()}`} r="27" /><text textAnchor="middle" y="45">{(node.name_english || node.node_id).slice(0, 19)}</text><text className="node-type" textAnchor="middle" y="58">{node.node_type}</text></g>)}</svg></div><div className="graph-legend"><span><i className="legend-dot entity-dot" />People / objects</span><span><i className="legend-dot event-dot" />Events</span><span><i className="legend-dot passage-dot" />Passages</span></div><div className="edge-list">{result.relationships.slice(0, 6).map((edge) => <div className="edge-row" key={edge.relationship_id}><b>{edge.relationship_type.replaceAll("_", " ")}</b><span>{edge.source_id} → {edge.target_id}</span><small>{edge.passage_id} · {edge.source_file} · pp. {edge.source_page_start}-{edge.source_page_end}</small></div>)}</div></>}
  </section>;
}
