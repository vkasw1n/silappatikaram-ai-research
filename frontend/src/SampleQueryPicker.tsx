import { useEffect, useState } from "react";
import { ChevronRight, Search, Shuffle } from "lucide-react";
import type { Language } from "./i18n";
import { translate } from "./i18n";

type Sample = { id: number; text: string; language: "en" | "ta"; category: string };
type Props = {
  language: Language;
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
  onSelect: (query: string) => void;
};

const categories = ["all", "corpus", "evidence", "graph", "interpretation", "verification"];

export default function SampleQueryPicker({ language, api, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [queryLanguage, setQueryLanguage] = useState<"all" | "en" | "ta">("all");
  const [category, setCategory] = useState("all");
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = async (randomSample = false) => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ search, language: queryLanguage, category, limit: "8", random_sample: String(randomSample) });
      const result = await api<{ queries: Sample[] }>(`/api/samples?${params}`);
      setSamples(result.queries);
    } catch {
      setSamples([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [search, queryLanguage, category]);

  return <section className="sample-query-picker" aria-labelledby="sample-query-heading">
    <div className="sample-query-heading">
      <div className="sample-query-title"><span className="eyebrow">{translate(language, "sampleQueries")}</span><h3 id="sample-query-heading">{translate(language, "searchSamples")}</h3></div>
      <div className="sample-query-actions"><span className="sample-query-count">{translate(language, "sampleCount").replace("{count}", String(samples.length))}</span><button type="button" className="sample-random-button" onClick={() => void load(true)}><Shuffle size={14} aria-hidden="true" />{translate(language, "randomSample")}</button></div>
    </div>
    <div className="sample-query-controls">
      <label className="sample-search-field"><span className="visually-hidden">{translate(language, "searchSamples")}</span><Search size={16} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={translate(language, "searchSamples")} /></label>
      <label className="sample-filter-field"><span>{translate(language, "language")}</span><select value={queryLanguage} onChange={(event) => setQueryLanguage(event.target.value as "all" | "en" | "ta")}>
        <option value="all">{translate(language, "allLanguages")}</option><option value="en">{translate(language, "english")}</option><option value="ta">{translate(language, "tamil")}</option>
      </select></label>
      <label className="sample-filter-field"><span>{translate(language, "queryType")}</span><select value={category} onChange={(event) => setCategory(event.target.value)}>
        {categories.map((item) => <option key={item} value={item}>{item === "all" ? translate(language, "allTypes") : item}</option>)}
      </select></label>
    </div>
    {loading ? <p className="sample-query-status">{translate(language, "working")}</p> : error ? <p className="sample-query-status">{translate(language, "sampleLoadError")}</p> : samples.length ? <div className="sample-query-list">{samples.map((sample) => <button type="button" className="sample-query-item" key={sample.id} onClick={() => onSelect(sample.text)}><span className="sample-query-meta"><span>{sample.language === "ta" ? translate(language, "tamil") : translate(language, "english")}</span><span>{sample.category}</span></span><span className="sample-query-text" lang={sample.language === "ta" ? "ta" : "en"}>{sample.text}</span><span className="sample-query-use">{translate(language, "useQuery")}<ChevronRight size={15} aria-hidden="true" /></span></button>)}</div> : <p className="sample-query-status">{translate(language, "noSamples")}</p>}
  </section>;
}