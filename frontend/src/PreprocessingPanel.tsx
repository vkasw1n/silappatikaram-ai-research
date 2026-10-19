type PreprocessingResult = {
  passage_count: number;
  sentence_count: number;
  entity_count: number;
  processing_time_ms: number;
  processing_version: string;
  capabilities: Record<string, string>;
};

type Props = { result: PreprocessingResult | null; busy: boolean; error: string; onRun: () => void };

export default function PreprocessingPanel({ result, busy, error, onRun }: Props) {
  const stages = ["Normalization", "Tokenization", "Sentence Segmentation", "NER", "Entity Linking", "Semantic Representation"];
  return <section className="preprocessing-panel">
    <div className="panel-heading"><div><span className="panel-number">02</span><h3>Tamil NLP / preprocessing</h3></div><span className="tag">FALLBACK-AWARE</span></div>
    <div className="stage-grid">{stages.map((stage) => <div className="stage" key={stage}><span>✓</span>{stage}</div>)}</div>
    <button className="run-button" onClick={onRun} disabled={busy}>{busy ? "Processing corpus..." : "Run preprocessing"}</button>
    {error && <div className="message error">! {error}</div>}
    {result && <div className="metrics">{[[result.passage_count, "Passages"], [result.sentence_count, "Sentences"], [result.entity_count, "Entities"], [`${result.processing_time_ms} ms`, "Processing time"]].map(([value, label]) => <div key={String(label)}><strong>{value}</strong><span>{label}</span></div>)}</div>}
    {result && <p className="fallback-note">Version {result.processing_version}. Morphology and POS tagging are explicitly unavailable; NER uses prepared entities only.</p>}
  </section>;
}