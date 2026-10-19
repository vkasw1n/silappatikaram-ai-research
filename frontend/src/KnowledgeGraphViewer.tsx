import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Crosshair,
  Network,
  X,
  Layers,
  ArrowRight,
  RefreshCw,
  Compass,
  Filter,
  Share2,
  CheckCircle2,
  FileText,
  ChevronDown,
  RotateCcw,
  BookOpen,
} from "lucide-react";

export type EntityCategory =
  | "Person"
  | "Object"
  | "Event"
  | "Concept"
  | "Place"
  | "Group"
  | "Literature"
  | "Work"
  | "Section"
  | "Passage"
  | "Evidence"
  | "Reasoning"
  | "Entity";

export interface CategoryStyle {
  fill: string;
  stroke: string;
  text: string;
  badgeBg: string;
  badgeText: string;
  label: string;
  tamilLabel: string;
  radius: number;
}

export const CATEGORY_STYLES: Record<EntityCategory, CategoryStyle> = {
  Person: {
    fill: "#eaf3f5",
    stroke: "#24728a",
    text: "#184f61",
    badgeBg: "#d8e9ed",
    badgeText: "#184f61",
    label: "Person / Character",
    tamilLabel: "மாந்தர் / பாத்திரம்",
    radius: 30,
  },
  Object: {
    fill: "#f9eee5",
    stroke: "#b55d2c",
    text: "#75401f",
    badgeBg: "#f1dccb",
    badgeText: "#75401f",
    label: "Object / Regalia",
    tamilLabel: "பொருள் / சிலம்பு",
    radius: 28,
  },
  Event: {
    fill: "#f7e9ed",
    stroke: "#ad4664",
    text: "#762f46",
    badgeBg: "#efd6de",
    badgeText: "#762f46",
    label: "Event / Episode",
    tamilLabel: "நிகழ்வு / காதை",
    radius: 30,
  },
  Concept: {
    fill: "#e8f1e8",
    stroke: "#3e785d",
    text: "#2c5a43",
    badgeBg: "#d5e6d6",
    badgeText: "#2c5a43",
    label: "Concept / Virtue",
    tamilLabel: "கருத்து / அறம் / ஊழ்",
    radius: 28,
  },
  Place: {
    fill: "#f0f1e4",
    stroke: "#718340",
    text: "#4d5c2c",
    badgeBg: "#e2e7cf",
    badgeText: "#4d5c2c",
    label: "Place / Geography",
    tamilLabel: "இடம் / நிலப்பரப்பு",
    radius: 28,
  },
  Group: {
    fill: "#f6f0df",
    stroke: "#a8782f",
    text: "#72501f",
    badgeBg: "#eee1bf",
    badgeText: "#72501f",
    label: "Group / Community",
    tamilLabel: "குழு / சமூகம்",
    radius: 28,
  },
  Literature: {
    fill: "#f2e7e4",
    stroke: "#914f45",
    text: "#653931",
    badgeBg: "#e9d4cf",
    badgeText: "#653931",
    label: "Literary Work",
    tamilLabel: "நூல் / காப்பியம்",
    radius: 38,
  },
  Work: {
    fill: "#f0eaf1",
    stroke: "#76527a",
    text: "#543b58",
    badgeBg: "#e4d9e6",
    badgeText: "#543b58",
    label: "Work",
    tamilLabel: "படைப்பு",
    radius: 36,
  },
  Section: {
    fill: "#e9eef0",
    stroke: "#54717b",
    text: "#354f58",
    badgeBg: "#d8e3e6",
    badgeText: "#354f58",
    label: "Section / Kaṇḍam",
    tamilLabel: "காண்டம் / காதை",
    radius: 32,
  },
  Passage: {
    fill: "#e9f3f3",
    stroke: "#397c80",
    text: "#28595c",
    badgeBg: "#d5e8e8",
    badgeText: "#28595c",
    label: "Verse / Sūtra",
    tamilLabel: "பாடல் / நூற்பா",
    radius: 30,
  },
  Evidence: {
    fill: "#eaf0e7",
    stroke: "#567647",
    text: "#3d5634",
    badgeBg: "#dce7d5",
    badgeText: "#3d5634",
    label: "Evidence Node",
    tamilLabel: "சான்று முனையம்",
    radius: 30,
  },
  Reasoning: {
    fill: "#fbf0dc",
    stroke: "#a57320",
    text: "#735018",
    badgeBg: "#f1e0bd",
    badgeText: "#735018",
    label: "Nyāya Rule / Step",
    tamilLabel: "நியாய விதி / ஏது",
    radius: 30,
  },
  Entity: {
    fill: "#edf0ee",
    stroke: "#77837e",
    text: "#45504a",
    badgeBg: "#dfe5e1",
    badgeText: "#45504a",
    label: "Entity",
    tamilLabel: "பொது உருப்படி",
    radius: 28,
  },
};

export function getCategoryOfNode(node: Record<string, any>): EntityCategory {
  const aliases: Record<string, EntityCategory> = {
    PERSON: "Person", CHARACTER: "Person", ROYALTY: "Person", DEITY: "Person",
    OBJECT: "Object", WEAPON: "Object", REGALIA: "Object", MONEY: "Object",
    EVENT: "Event", EPISODE: "Event",
    CONCEPT: "Concept", VIRTUE: "Concept", KARMA: "Concept", IDEA: "Concept",
    PLACE: "Place", LOCATION: "Place", CITY: "Place", REGION: "Place",
    GROUP: "Group", PERSON_ROLE: "Group", COMMUNITY: "Group",
    LITERATURE: "Literature", LITERARY_WORK: "Literature", EPIC: "Literature", CORPUS: "Literature",
    WORK: "Work", BOOK: "Work", POEM: "Work",
    SECTION: "Section", KANDAM: "Section", KANTAM: "Section", CANTO: "Section", CHAPTER: "Section",
    PASSAGE: "Passage", VERSE: "Passage", SUTRA: "Passage",
    EVIDENCE: "Evidence", EVIDENCE_NODE: "Evidence",
    REASONING: "Reasoning", PREMISE: "Reasoning", RULE: "Reasoning", INFERENCE: "Reasoning", CONCLUSION: "Reasoning",
  };
  const hints = [node.category, node.type, node.node_type, node.entity_type, node.layer, node.hierarchy_level];

  for (const hint of hints) {
    const normalized = String(hint || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (aliases[normalized]) return aliases[normalized];
  }
  if (node.isEvidenceRecord) return "Evidence";
  if (node.proposition_id) return "Reasoning";
  return "Entity";
}

export function extractNodeId(nodeOrId: any): string {
  if (!nodeOrId) return "";
  if (typeof nodeOrId === "string" || typeof nodeOrId === "number") {
    return String(nodeOrId);
  }
  return String(nodeOrId.node_id || nodeOrId.id || nodeOrId.name || "");
}

export interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  node_id: string;
  node_type: string;
  entity_type?: string;
  name_english?: string;
  name_tamil?: string;
  description?: string;
  kandam?: string;
  section_number?: string;
  section_name?: string;
  event_type?: string;
  event_name_tamil?: string;
  event_name_english?: string;
  source_file?: string;
  source_page_start?: string;
  source_page_end?: string;
  category: EntityCategory;
  color: string;
  bgColor: string;
  textColor: string;
  radius: number;
  label: string;
  [key: string]: any;
}

export interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  relationship_id: string;
  source_id: string;
  target_id: string;
  relationship_type: string;
  passage_id?: string;
  event_id?: string;
  evidence?: string;
  confidence?: string | number;
  source_file?: string;
  source_page_start?: string;
  source_page_end?: string;
  label: string;
  totalParallelLinks?: number;
  linkIndex?: number;
  laneCurveOffset?: number;
  source: SimNode;
  target: SimNode;
  [key: string]: any;
}

export interface KnowledgeGraphViewerProps {
  nodes: Record<string, any>[];
  relationships: Record<string, any>[];
  backend?: string;
  isValidated?: boolean;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  onExpandNeighborhood?: (nodeId: string) => Promise<void> | void;
  isExpanding?: boolean;
  hopDepth?: 1 | 2;
  onChangeHopDepth?: (hops: 1 | 2) => void;
  activeQueryString?: string;
}

export default function KnowledgeGraphViewer({
  nodes: rawNodes,
  relationships: rawEdges,
  backend = "csv",
  selectedNodeId: propSelectedNodeId,
  onSelectNode,
  onExpandNeighborhood,
  isExpanding = false,
  hopDepth = 1,
  onChangeHopDepth,
  activeQueryString = "",
}: KnowledgeGraphViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const prevPositionsRef = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(new Map());
  const dragStartPosRef = useRef({ x: 0, y: 0, moved: false });
  const graphDataRef = useRef<{ nodes: SimNode[]; edges: SimLink[] }>({ nodes: [], edges: [] });
  const focusOnNeighborhoodRef = useRef<((nodeId: string, padding?: number, duration?: number) => void) | null>(null);
  const applyHighlightsRef = useRef<(() => void) | null>(null);

  const [localSelectedId, setLocalSelectedId] = useState<string | null>(propSelectedNodeId || null);
  const activeSelectedId = propSelectedNodeId !== undefined ? propSelectedNodeId : localSelectedId;

  const [selectedEdgeData, setSelectedEdgeData] = useState<SimLink | null>(null);
  const [currentLayout, setCurrentLayout] = useState<"force" | "hierarchical" | "radial">("force");
  const [zoomLevelPercent, setZoomLevelPercent] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");
  const [selectedRelFilter, setSelectedRelFilter] = useState<string>("ALL");
  const [selectedHierarchyFilter, setSelectedHierarchyFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"details" | "triples">("details");
  const [inspectorWidth, setInspectorWidth] = useState(460);
  const [isResizingInspector, setIsResizingInspector] = useState(false);
  const activeSelectedIdRef = useRef<string | null>(null);
  const hopDepthRef = useRef(hopDepth);
  const zoomScaleRef = useRef(1);
  const hoveredEdgeIdRef = useRef<string | null>(null);
  const userAdjustedViewRef = useRef(false);
  const onSelectNodeRef = useRef(onSelectNode);
  activeSelectedIdRef.current = activeSelectedId;
  hopDepthRef.current = hopDepth;
  onSelectNodeRef.current = onSelectNode;

  useEffect(() => {
    if (!isResizingInspector) return undefined;
    const handlePointerMove = (event: PointerEvent) => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds || window.innerWidth <= 1100) return;
      const nextWidth = Math.min(620, Math.max(340, bounds.right - event.clientX));
      setInspectorWidth(nextWidth);
    };
    const stopResizing = () => setIsResizingInspector(false);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
    };
  }, [isResizingInspector]);

  const adjustInspectorWidth = (delta: number) => {
    setInspectorWidth((current) => Math.min(620, Math.max(340, current + delta)));
  };

  useEffect(() => {
    if (propSelectedNodeId !== undefined) {
      setLocalSelectedId(propSelectedNodeId);
    }
  }, [propSelectedNodeId]);

  const selectNode = useCallback(
    (nodeId: string | null) => {
      setLocalSelectedId(nodeId);
      onSelectNodeRef.current?.(nodeId);
      if (!nodeId) {
        setSelectedEdgeData(null);
      }
    },
    []
  );

  // Normalize data with circular node coordinates & parallel edge routing
  const { normalizedNodes, normalizedLinks, availableCategories, availableRelationshipTypes } = useMemo(() => {
    const nodeMap = new Map<string, SimNode>();
    const nodesList: SimNode[] = [];

    rawNodes.forEach((n) => {
      const id = extractNodeId(n);
      if (!id || nodeMap.has(id)) return;
      const category = getCategoryOfNode(n);
      const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.Entity;

      const norm: SimNode = {
        ...n,
        id,
        node_id: n.node_id || id,
        node_type: n.node_type || "ENTITY",
        label: n.name_english || n.name_tamil || id,
        category,
        color: style.stroke,
        bgColor: style.fill,
        textColor: style.text,
        radius: style.radius,
      };
      nodeMap.set(id, norm);
      nodesList.push(norm);
    });

    const validEdges: any[] = [];
    const edgeIds = new Set<string>();

    rawEdges.forEach((e) => {
      const sId = extractNodeId(e.source ?? e.source_id);
      const tId = extractNodeId(e.target ?? e.target_id);
      if (!nodeMap.has(sId) || !nodeMap.has(tId)) return;

      const edgeId = String(e.relationship_id || e.id || `${sId}->${tId}:${e.relationship_type || (e as any).type || "RELATED_TO"}`);
      if (edgeIds.has(edgeId)) return;
      edgeIds.add(edgeId);

      validEdges.push({
        ...e,
        id: edgeId,
        relationship_id: edgeId,
        source_id: sId,
        target_id: tId,
        relationship_type: e.relationship_type || (e as any).type || "RELATED_TO",
        label: String(e.relationship_type || (e as any).type || "").replace(/_/g, " "),
      });
    });

    const edgesByPair = new Map<string, any[]>();
    validEdges.forEach((edge) => {
      const pairKey = [edge.source_id, edge.target_id].sort().join("<->");
      const pair = edgesByPair.get(pairKey) || [];
      pair.push(edge);
      edgesByPair.set(pairKey, pair);
    });

    const pairIndices = new Map<string, number>();
    const directionIndices = new Map<string, number>();
    const linksList = validEdges.map((e) => {
      const sId = e.source_id;
      const tId = e.target_id;
      const pairKey = [sId, tId].sort().join("<->");
      const pair = edgesByPair.get(pairKey) || [e];
      const total = pair.length;
      const pairIndex = pairIndices.get(pairKey) || 0;
      pairIndices.set(pairKey, pairIndex + 1);
      const canonicalForward = sId.localeCompare(tId) <= 0;
      const directionKey = `${pairKey}:${canonicalForward ? "forward" : "reverse"}`;
      const directionIndex = directionIndices.get(directionKey) || 0;
      directionIndices.set(directionKey, directionIndex + 1);
      const directionCount = pair.filter((edge) => (edge.source_id.localeCompare(edge.target_id) <= 0) === canonicalForward).length;
      const hasReverseDirection = pair.some((edge) => (edge.source_id.localeCompare(edge.target_id) <= 0) !== canonicalForward);
      const centeredLane = (directionIndex - (directionCount - 1) / 2) * 20;
      const laneCurveOffset = total > 1
        ? centeredLane + (hasReverseDirection ? 17 : 0)
        : 0;

      return {
        ...e,
        totalParallelLinks: total,
        linkIndex: pairIndex,
        laneCurveOffset,
      };
    });

    const degreeByNode = new Map<string, number>();
    linksList.forEach((link) => {
      degreeByNode.set(link.source_id, (degreeByNode.get(link.source_id) || 0) + 1);
      degreeByNode.set(link.target_id, (degreeByNode.get(link.target_id) || 0) + 1);
    });
    nodesList.forEach((node) => {
      const baseRadius = CATEGORY_STYLES[node.category]?.radius || CATEGORY_STYLES.Entity.radius;
      node.radius = baseRadius + Math.min(8, Math.max(0, (degreeByNode.get(node.id) || 0) - 2) * 1.25);
    });

    const catSet = new Set<string>();
    nodesList.forEach((n) => catSet.add(n.category));

    const relSet = new Set<string>();
    linksList.forEach((l) => relSet.add(l.relationship_type));

    return {
      normalizedNodes: nodesList,
      normalizedLinks: linksList,
      availableCategories: Array.from(catSet).sort(),
      availableRelationshipTypes: Array.from(relSet).sort(),
    };
  }, [rawNodes, rawEdges]);

  // Visual Filtering
  const { filteredNodes, filteredLinks } = useMemo(() => {
    let nodes = [...normalizedNodes];
    let links = [...normalizedLinks];

    if (selectedCategoryFilter !== "ALL") {
      nodes = nodes.filter((n) => n.category === selectedCategoryFilter);
    }

    if (selectedRelFilter !== "ALL") {
      links = links.filter((l) => l.relationship_type === selectedRelFilter);
    }

    if (selectedHierarchyFilter !== "ALL") {
      if (selectedHierarchyFilter === "Kandam") {
        nodes = nodes.filter((n) => Boolean(n.kandam));
      } else if (selectedHierarchyFilter === "Passage") {
        nodes = nodes.filter((n) => n.category === "Passage");
      } else if (selectedHierarchyFilter === "Entity") {
        nodes = nodes.filter((n) => n.node_type === "ENTITY");
      } else if (selectedHierarchyFilter === "Literary structure") {
        nodes = nodes.filter((n) => ["Literature", "Work", "Section", "Passage"].includes(n.category));
      } else if (selectedHierarchyFilter === "Event") {
        nodes = nodes.filter((n) => n.category === "Event");
      }
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    const activeLinks = links.filter((l) => nodeIds.has(l.source_id) && nodeIds.has(l.target_id));

    return {
      filteredNodes: nodes,
      filteredLinks: activeLinks,
    };
  }, [normalizedNodes, normalizedLinks, selectedCategoryFilter, selectedRelFilter, selectedHierarchyFilter]);

  // Selected node
  const selectedNode = useMemo(() => {
    if (!activeSelectedId) return null;
    return normalizedNodes.find((n) => n.id === activeSelectedId) || null;
  }, [normalizedNodes, activeSelectedId]);

  const adjacencyByNode = useMemo(() => {
    const adjacency = new Map<string, Array<{ edge: SimLink; otherId: string; outward: boolean }>>();
    normalizedLinks.forEach((edge) => {
      const sourceId = edge.source_id;
      const targetId = edge.target_id;
      const outgoing = adjacency.get(sourceId) || [];
      outgoing.push({ edge: edge as SimLink, otherId: targetId, outward: true });
      adjacency.set(sourceId, outgoing);
      const incoming = adjacency.get(targetId) || [];
      incoming.push({ edge: edge as SimLink, otherId: sourceId, outward: false });
      adjacency.set(targetId, incoming);
    });
    return adjacency;
  }, [normalizedLinks]);

  const visibleAdjacencyByNode = useMemo(() => {
    const adjacency = new Map<string, Array<{ edge: SimLink; otherId: string }>>();
    filteredLinks.forEach((edge) => {
      const sourceId = edge.source_id;
      const targetId = edge.target_id;
      const outgoing = adjacency.get(sourceId) || [];
      outgoing.push({ edge: edge as SimLink, otherId: targetId });
      adjacency.set(sourceId, outgoing);
      const incoming = adjacency.get(targetId) || [];
      incoming.push({ edge: edge as SimLink, otherId: sourceId });
      adjacency.set(targetId, incoming);
    });
    return adjacency;
  }, [filteredLinks]);

  // Direct relations for selected node
  const directConnections = useMemo(() => {
    if (!selectedNode) return [];
    const nodeMap = new Map(normalizedNodes.map((n) => [n.id, n]));
    return (adjacencyByNode.get(selectedNode.id) || []).flatMap(({ edge, otherId, outward }) => {
      const node = nodeMap.get(otherId);
      return node ? [{ edge, node, outward }] : [];
    });
  }, [selectedNode, normalizedNodes, adjacencyByNode]);

  // Active triples (Image 3 format)
  const activeTriples = useMemo(() => {
    const nodeMap = new Map(normalizedNodes.map((n) => [n.id, n]));
    const edgesToUse = selectedNode
      ? directConnections.map((c) => c.edge)
      : normalizedLinks.slice(0, 16);

    return edgesToUse.map((edge) => {
      const sNode = nodeMap.get(edge.source_id);
      const tNode = nodeMap.get(edge.target_id);
      return {
        id: edge.id,
        subject: sNode?.name_english || sNode?.name_tamil || edge.source_id,
        subjectCategory: sNode?.category || "Entity",
        predicate: edge.relationship_type.replace(/_/g, " "),
        object: tNode?.name_english || tNode?.name_tamil || edge.target_id,
        objectCategory: tNode?.category || "Entity",
        evidence: edge.evidence,
        relationshipId: edge.relationship_id,
        passageId: edge.passage_id,
        sourceFile: edge.source_file,
        pageStart: edge.source_page_start,
        pageEnd: edge.source_page_end,
      };
    });
  }, [normalizedNodes, normalizedLinks, selectedNode, directConnections]);

  // Fit View
  const fitView = useCallback((padding = 65, duration = 380) => {
    const svg = svgRef.current;
    const container = canvasRef.current;
    if (!svg || !container || !zoomBehaviorRef.current) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 580;
    const nodes = graphDataRef.current.nodes;
    if (nodes.length === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    nodes.forEach((n) => {
      const x = typeof n.x === "number" ? n.x : width / 2;
      const y = typeof n.y === "number" ? n.y : height / 2;
      const r = n.radius || 30;
      if (x - r < minX) minX = x - r;
      if (x + r > maxX) maxX = x + r;
      if (y - r < minY) minY = y - r;
      if (y + r > maxY) maxY = y + r;
    });

    const graphWidth = Math.max(1, maxX - minX);
    const graphHeight = Math.max(1, maxY - minY);

    const scaleX = (width - padding * 2) / graphWidth;
    const scaleY = (height - padding * 2) / graphHeight;
    const scale = Math.max(0.28, Math.min(1.5, Math.min(scaleX, scaleY)));

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const translateX = width / 2 - scale * midX;
    const translateY = height / 2 - scale * midY;

    const targetTransform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);

    const d3Svg = d3.select(svg);
    d3Svg.interrupt().call(zoomBehaviorRef.current.transform, targetTransform);
  }, []);

  // Focus on Neighborhood
  const focusOnNeighborhood = useCallback((centerId: string, padding = 80, duration = 500) => {
    const svg = svgRef.current;
    const container = canvasRef.current;
    if (!svg || !container || !zoomBehaviorRef.current || !centerId) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 580;
    const { nodes, edges } = graphDataRef.current;
    if (nodes.length === 0) return;

    const centerNode = nodes.find((n) => n.id === centerId);
    if (!centerNode || typeof centerNode.x !== "number" || typeof centerNode.y !== "number") return;

    const neighbors = new Set<string>([centerId]);
    let frontier = [centerId];
    for (let depth = 0; depth < hopDepthRef.current; depth += 1) {
      const nextFrontier: string[] = [];
      frontier.forEach((nodeId) => {
        (visibleAdjacencyByNode.get(nodeId) || []).forEach(({ otherId }) => {
          if (!neighbors.has(otherId)) {
            neighbors.add(otherId);
            nextFrontier.push(otherId);
          }
        });
      });
      frontier = nextFrontier;
    }

    const neighborhoodNodes = nodes.filter((n) => neighbors.has(n.id));
    if (neighborhoodNodes.length === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    neighborhoodNodes.forEach((n) => {
      const nx = typeof n.x === "number" ? n.x : (typeof centerNode.x === "number" ? centerNode.x : width / 2);
      const ny = typeof n.y === "number" ? n.y : (typeof centerNode.y === "number" ? centerNode.y : height / 2);
      const r = (n.radius || 28) + 20;
      if (nx - r < minX) minX = nx - r;
      if (nx + r > maxX) maxX = nx + r;
      if (ny - r < minY) minY = ny - r;
      if (ny + r > maxY) maxY = ny + r;
    });

    const boxWidth = Math.max(90, maxX - minX);
    const boxHeight = Math.max(90, maxY - minY);

    const availWidth = Math.max(100, width - padding * 2);
    const availHeight = Math.max(100, height - padding * 2);
    const scale = Math.max(0.34, Math.min(1.08, Math.min(availWidth / boxWidth, availHeight / boxHeight)));

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const translateX = width / 2 - scale * midX;
    const translateY = height / 2 - scale * midY;

    const targetTransform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);

    d3.select(svg)
      .transition()
      .duration(duration)
      .ease(d3.easeCubicOut)
      .call(zoomBehaviorRef.current.transform, targetTransform);
  }, []);

  useEffect(() => {
    focusOnNeighborhoodRef.current = focusOnNeighborhood;
  }, [focusOnNeighborhood]);

  // Main D3 simulation & render loop
  useEffect(() => {
    const container = canvasRef.current;
    const svgEl = svgRef.current;
    if (!container || !svgEl) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 580;
    const nodeCount = filteredNodes.length;
    const isLargeGraph = nodeCount > 70;
    userAdjustedViewRef.current = false;

    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current.on("tick", null);
      simulationRef.current.on("end", null);
      simulationRef.current = null;
    }

    const svg = d3.select(svgEl);

    // Defs: Markers & Glow filters
    let defs: d3.Selection<any, any, any, any> = svg.select("defs");
    if (defs.empty()) {
      defs = svg.append("defs");

      defs
        .append("marker")
        .attr("id", "kg-arrow-default")
        .attr("viewBox", "0 -4 8 8")
        .attr("refX", 7)
        .attr("refY", 0)
        .attr("markerWidth", 8)
        .attr("markerHeight", 8)
        .attr("markerUnits", "userSpaceOnUse")
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M 0,-3.2 L 7,0 L 0,3.2 Z")
        .attr("fill", "#788b9a");

      defs
        .append("marker")
        .attr("id", "kg-arrow-connected-out")
        .attr("viewBox", "0 -4 8 8")
        .attr("refX", 7)
        .attr("refY", 0)
        .attr("markerWidth", 8)
        .attr("markerHeight", 8)
        .attr("markerUnits", "userSpaceOnUse")
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M 0,-3.2 L 7,0 L 0,3.2 Z")
        .attr("fill", "#914f45");

      defs
        .append("marker")
        .attr("id", "kg-arrow-connected-in")
        .attr("viewBox", "0 -4 8 8")
        .attr("refX", 7)
        .attr("refY", 0)
        .attr("markerWidth", 8)
        .attr("markerHeight", 8)
        .attr("markerUnits", "userSpaceOnUse")
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M 0,-3.2 L 7,0 L 0,3.2 Z")
        .attr("fill", "#397c80");

      const shadow = defs
        .append("filter")
        .attr("id", "kg-node-shadow")
        .attr("x", "-25%")
        .attr("y", "-25%")
        .attr("width", "160%")
        .attr("height", "160%");
      shadow
        .append("feDropShadow")
        .attr("dx", "0")
        .attr("dy", "2")
        .attr("stdDeviation", "3.5")
        .attr("flood-color", "#0f172a")
        .attr("flood-opacity", "0.08");

      const selectedGlow = defs
        .append("filter")
        .attr("id", "kg-selected-glow")
        .attr("x", "-35%")
        .attr("y", "-35%")
        .attr("width", "170%")
        .attr("height", "170%");
      selectedGlow
        .append("feDropShadow")
        .attr("dx", "0")
        .attr("dy", "0")
        .attr("stdDeviation", "6")
        .attr("flood-color", "#914f45")
        .attr("flood-opacity", "0.75");
    }

    // Viewport structure
    let g = svg.select<SVGGElement>("g.kg-viewport");
    if (g.empty()) {
      g = svg.append("g").attr("class", "kg-viewport");
      g.append("g").attr("class", "kg-links-layer");
      g.append("g").attr("class", "kg-link-labels-layer");
      g.append("g").attr("class", "kg-nodes-layer");
      g.append("g").attr("class", "kg-node-labels-layer");
    }

    const linksGroup = g.select<SVGGElement>("g.kg-links-layer");
    const linkLabelsGroup = g.select<SVGGElement>("g.kg-link-labels-layer");
    const nodesGroup = g.select<SVGGElement>("g.kg-nodes-layer");
    const nodeLabelsGroup = g.select<SVGGElement>("g.kg-node-labels-layer");

    // Zoom behavior
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4.0])
      .on("zoom", (event) => {
        if (event.sourceEvent) userAdjustedViewRef.current = true;
        g.attr("transform", event.transform.toString());
        zoomScaleRef.current = event.transform.k;
        setZoomLevelPercent(Math.round(event.transform.k * 100));
        nodeLabelsGroup.attr("display", null);
        nodeLabelsGroup.attr("display", null);
        nodeLabelsGroup.selectAll<SVGGElement, SimNode>("g.kg-node-label").attr("display", null);
        linkLabelsGroup.attr("display", null);
        applyHighlightsRef.current?.();
      });

    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior).on("dblclick.zoom", null);

    svg.on("click", (event) => {
      if (event.target === svgEl) {
        selectNode(null);
      }
    });

    const prevPositions = prevPositionsRef.current;
    const simNodes: SimNode[] = filteredNodes.map((n, idx) => {
      const existing = prevPositions.get(n.id);
      let initX = existing?.x;
      let initY = existing?.y;

      if (initX === undefined || initY === undefined) {
        const angle = idx * Math.PI * (3 - Math.sqrt(5));
        const spacing = Math.max(112, n.radius * 2 + 50);
        const r = spacing * Math.sqrt((idx + 0.5) / Math.PI);
        initX = width / 2 + r * Math.cos(angle);
        initY = height / 2 + r * Math.sin(angle);
      }

      return {
        ...n,
        x: initX,
        y: initY,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
      };
    });

    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

    const simLinks: SimLink[] = filteredLinks
      .map((l) => {
        const sNode = nodeMap.get(l.source_id);
        const tNode = nodeMap.get(l.target_id);
        if (!sNode || !tNode) return null;
        return {
          ...l,
          source: sNode,
          target: tNode,
        };
      })
      .filter(Boolean) as SimLink[];

    graphDataRef.current = { nodes: simNodes, edges: simLinks };

    // Layout algorithms
    if (currentLayout === "radial") {
      const cx = width / 2;
      const cy = height / 2;
      const rootId = activeSelectedIdRef.current || simNodes[0]?.id;
      const rootNode = simNodes.find((n) => n.id === rootId);
      if (rootNode) {
        rootNode.x = cx;
        rootNode.y = cy;
      }

      const others = simNodes.filter((n) => n !== rootNode);
      const inner = others.filter((n) => ["Person", "Passage", "Event"].includes(n.category));
      const outer = others.filter((n) => !inner.includes(n));

      const rInner = Math.min(width, height) * 0.28;
      const rOuter = Math.min(width, height) * 0.46;

      inner.forEach((n, idx) => {
        const angle = (2 * Math.PI * idx) / Math.max(1, inner.length) - Math.PI / 2;
        n.x = cx + rInner * Math.cos(angle);
        n.y = cy + rInner * Math.sin(angle);
        prevPositions.set(n.id, { x: n.x, y: n.y, vx: 0, vy: 0 });
      });

      outer.forEach((n, idx) => {
        const angle = (2 * Math.PI * idx) / Math.max(1, outer.length) - Math.PI / 2;
        n.x = cx + rOuter * Math.cos(angle);
        n.y = cy + rOuter * Math.sin(angle);
        prevPositions.set(n.id, { x: n.x, y: n.y, vx: 0, vy: 0 });
      });

      simulationRef.current = null;
    } else if (currentLayout === "hierarchical") {
      const tierRank: Record<EntityCategory, number> = {
        Literature: 0,
        Work: 1,
        Section: 1,
        Passage: 2,
        Event: 3,
        Person: 4,
        Object: 4,
        Place: 4,
        Group: 4,
        Concept: 5,
        Evidence: 5,
        Reasoning: 6,
        Entity: 5,
      };

      const tiers: SimNode[][] = [[], [], [], [], [], [], []];
      simNodes.forEach((n) => {
        const rank = tierRank[n.category] ?? 4;
        tiers[rank].push(n);
      });

      const activeTiers = tiers.map((nodes, rank) => ({ rank, nodes })).filter((t) => t.nodes.length > 0);
      const tierCount = activeTiers.length;

      activeTiers.forEach((tierObj, slotIdx) => {
        const y = height * (0.12 + 0.76 * (slotIdx / Math.max(1, tierCount - 1)));
        const count = tierObj.nodes.length;
        tierObj.nodes.forEach((n, i) => {
          n.x = count <= 1 ? width / 2 : ((i + 1) / (count + 1)) * (width - 120) + 60;
          n.y = y;
          prevPositions.set(n.id, { x: n.x, y: n.y, vx: 0, vy: 0 });
        });
      });

      simulationRef.current = null;
    } else {
      // Force-directed physics
      const linkDist = isLargeGraph ? 260 : 224;
      const baseCharge = isLargeGraph ? -1050 : -760;
      const nodeDegree = new Map<string, number>();
      simLinks.forEach((link) => {
        nodeDegree.set(link.source.id, (nodeDegree.get(link.source.id) || 0) + 1);
        nodeDegree.set(link.target.id, (nodeDegree.get(link.target.id) || 0) + 1);
      });

      const simulation = d3
        .forceSimulation<SimNode>(simNodes)
        .force(
          "link",
          d3
            .forceLink<SimNode, SimLink>(simLinks)
            .id((d) => d.id)
            .distance((link) => {
              const sourceRadius = typeof link.source === "string" ? 28 : link.source.radius;
              const targetRadius = typeof link.target === "string" ? 28 : link.target.radius;
              return Math.max(linkDist, sourceRadius + targetRadius + (isLargeGraph ? 56 : 44));
            })
            .strength(isLargeGraph ? 0.3 : 0.42)
        )
        .force("charge", d3.forceManyBody<SimNode>().strength((node) => baseCharge - Math.min(360, (nodeDegree.get(node.id) || 0) * 16)).distanceMax(1200))
        .force("center", d3.forceCenter(width / 2, height / 2).strength(0.025))
        .force("x", d3.forceX(width / 2).strength(0.012))
        .force("y", d3.forceY(height / 2).strength(0.012))
        .force(
          "collide",
          d3
            .forceCollide<SimNode>()
            .radius((d) => (d.radius || 28) + (isLargeGraph ? 42 : 34))
            .iterations(3)
        )
        .alpha(isLargeGraph ? 0.9 : 0.8)
        .alphaMin(0.005)
        .alphaDecay(isLargeGraph ? 0.032 : 0.035);

      const prewarm = isLargeGraph ? 36 : 24;
      for (let i = 0; i < prewarm; ++i) {
        simulation.tick();
      }

      simulationRef.current = simulation;
    }

    const computeEdgePath = (d: SimLink) => {
      const sx = d.source.x ?? 0;
      const sy = d.source.y ?? 0;
      const tx = d.target.x ?? 0;
      const ty = d.target.y ?? 0;
      const sRadius = d.source.radius || 28;
      const tRadius = d.target.radius || 28;

      if (d.source.id === d.target.id) {
        const loopR = sRadius + 14;
        return `M ${sx - sRadius * 0.4} ${sy - sRadius * 0.9} C ${sx - loopR * 1.6} ${sy - loopR * 2.3}, ${sx + loopR * 1.6} ${sy - loopR * 2.3}, ${sx + sRadius * 0.4} ${sy - sRadius * 0.9}`;
      }

      const dx = tx - sx;
      const dy = ty - sy;
      const dist = Math.hypot(dx, dy) || 1;
      const targetOffset = tRadius + 2;
      const sourceOffset = sRadius + 1;
      const startX = sx + (dx / dist) * sourceOffset;
      const startY = sy + (dy / dist) * sourceOffset;
      const endX = tx - (dx / dist) * targetOffset;
      const endY = ty - (dy / dist) * targetOffset;

      if (d.totalParallelLinks && d.totalParallelLinks > 1) {
        const curveOffset = d.laneCurveOffset || 0;
        const nx = -dy / dist;
        const ny = dx / dist;
        const mx = (startX + endX) / 2;
        const my = (startY + endY) / 2;
        const cx = mx + nx * curveOffset;
        const cy = my + ny * curveOffset;
        return `M ${startX} ${startY} Q ${cx} ${cy} ${endX} ${endY}`;
      }

      return `M ${startX} ${startY} L ${endX} ${endY}`;
    };

    const computeEdgeLabelTransform = (d: SimLink) => {
      const sx = d.source.x ?? 0;
      const sy = d.source.y ?? 0;
      const tx = d.target.x ?? 0;
      const ty = d.target.y ?? 0;

      if (d.source.id === d.target.id) {
        const loopR = (d.source.radius || 28) + 14;
        return `translate(${sx}, ${sy - loopR * 2.1})`;
      }

      if (d.totalParallelLinks && d.totalParallelLinks > 1) {
        const curveOffset = d.laneCurveOffset || 0;
        const dx = tx - sx;
        const dy = ty - sy;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = -dy / dist;
        const ny = dx / dist;
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        const cx = mx + nx * curveOffset;
        const cy = my + ny * curveOffset;
        const px = 0.25 * sx + 0.5 * cx + 0.25 * tx;
        const py = 0.25 * sy + 0.5 * cy + 0.25 * ty;
        return `translate(${px}, ${py})`;
      }

      const mx = (sx + tx) / 2;
      const my = (sy + ty) / 2;
      return `translate(${mx}, ${my})`;
    };

    // 1. RENDER LINKS
    const linkElements = linksGroup
      .selectAll<SVGPathElement, SimLink>("path.kg-edge")
      .data(simLinks, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("path")
            .attr("class", "kg-edge transition-opacity duration-200 cursor-pointer")
            .attr("fill", "none")
            .attr("stroke", "#8799a6")
            .attr("stroke-width", 1.25)
            .attr("stroke-opacity", 0.58)
            .attr("marker-end", "url(#kg-arrow-default)"),
        (update) => update,
        (exit) => exit.remove()
      );

    // 2. RENDER LINK LABELS
    const linkLabelElements = linkLabelsGroup
      .selectAll<SVGGElement, SimLink>("g.kg-edge-label-group")
      .data(simLinks, (d) => d.id)
      .join(
        (enter) => {
          const gLabel = enter
            .append("g")
            .attr("class", "kg-edge-label-group cursor-pointer select-none pointer-events-none")
            .attr("opacity", 0.95);

          gLabel.each(function (d) {
            const el = d3.select(this);
            const labelText = d.label || d.relationship_type || "";
            const estimatedWidth = Math.max(42, labelText.length * 7.4 + 18);

            el.append("rect")
              .attr("rx", 4)
              .attr("ry", 4)
              .attr("fill", "#ffffff")
              .attr("stroke", "#cbd5e1")
              .attr("stroke-width", 1)
              .attr("height", 22)
              .attr("y", -11)
              .attr("x", -estimatedWidth / 2)
              .attr("width", estimatedWidth);

            el.append("text")
              .attr("text-anchor", "middle")
              .attr("dominant-baseline", "central")
              .attr("font-size", "12px")
              .attr("font-family", "system-ui, sans-serif")
              .attr("font-weight", "600")
              .attr("fill", "#334155")
              .text(labelText);
          });

          return gLabel;
        },
        (update) => update,
        (exit) => exit.remove()
      );

    // 3. RENDER CIRCULAR NODES
    const nodeElements = nodesGroup
      .selectAll<SVGGElement, SimNode>("g.kg-node")
      .data(simNodes, (d) => d.id)
      .join(
        (enter) => {
          const gNode = enter
            .append("g")
            .attr("class", "kg-node cursor-pointer transition-opacity duration-200")
            .attr("id", (d) => `kg-node-${d.id}`)
            .attr("transform", (d) => `translate(${d.x}, ${d.y})`);

          gNode
            .append("circle")
            .attr("class", "node-selection-halo")
            .attr("r", (d) => d.radius + 12)
            .attr("fill", "rgba(124, 58, 237, 0.16)")
            .attr("stroke", "none")
            .attr("opacity", 0);

          gNode
            .append("circle")
            .attr("class", "node-selection-ring")
            .attr("r", (d) => d.radius + 6)
            .attr("fill", "none")
            .attr("stroke", "#7c3aed")
            .attr("stroke-width", 2.5)
            .attr("stroke-dasharray", "4 3")
            .attr("opacity", 0);

          gNode
            .append("circle")
            .attr("class", "node-neighbor-ring")
            .attr("r", (d) => d.radius + 4)
            .attr("fill", "none")
            .attr("stroke", "#10b981")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "3 2")
            .attr("opacity", 0);

          gNode
            .append("circle")
            .attr("class", "node-main-circle")
            .attr("r", (d) => d.radius)
            .attr("fill", (d) => d.bgColor)
            .attr("stroke", (d) => d.color)
            .attr("stroke-width", 2.5)
            .attr("filter", "url(#kg-node-shadow)");

          return gNode;
        },
        (update) => {
          update
            .select(".node-main-circle")
            .attr("r", (d) => d.radius)
            .attr("fill", (d) => d.bgColor)
            .attr("stroke", (d) => d.color);
          return update;
        },
        (exit) => exit.remove()
      );

    // 4. RENDER NODE LABELS
    const nodeLabelElements = nodeLabelsGroup
      .selectAll<SVGGElement, SimNode>("g.kg-node-label")
      .data(simNodes, (d) => d.id)
      .join(
        (enter) => {
          const gLabel = enter
            .append("g")
            .attr("class", "kg-node-label pointer-events-none select-none")
            .attr("transform", (d) => `translate(${d.x}, ${d.y})`);

          gLabel.each(function (d) {
            const el = d3.select(this);
            const englishName = d.name_english || d.event_name_english || d.id;
            const tamilName = d.name_tamil || d.event_name_tamil || "";
            const oneWordLabel = (englishName || tamilName || d.category || "Entity").split(/\s+/)[0];
            const shortLabel = oneWordLabel.length > 12 ? `${oneWordLabel.slice(0, 10)}…` : oneWordLabel;

            el.append("text")
              .attr("class", "node-label-main tamil-font")
              .attr("text-anchor", "middle")
              .attr("dominant-baseline", "central")
              .attr("font-size", "13px")
              .attr("font-weight", "700")
              .attr("fill", d.textColor || "#0f172a")
              .attr("paint-order", "stroke fill")
              .attr("stroke", "#ffffff")
              .attr("stroke-width", "3.2px")
              .attr("stroke-linejoin", "round")
              .text(shortLabel);
          });

          return gLabel;
        },
        (update) => update,
        (exit) => exit.remove()
      );

    // Node Drag Behavior
    const dragBehavior = d3
      .drag<SVGGElement, SimNode>()
      .on("start", (event, d) => {
        if (event.sourceEvent) event.sourceEvent.stopPropagation();
        userAdjustedViewRef.current = true;
        dragStartPosRef.current = { x: event.x, y: event.y, moved: false };
        d.fx = d.x;
        d.fy = d.y;
        if (simulationRef.current) {
          simulationRef.current.alphaTarget(0.12).restart();
        }
      })
      .on("drag", (event, d) => {
        const dx = event.x - dragStartPosRef.current.x;
        const dy = event.y - dragStartPosRef.current.y;
        if (Math.hypot(dx, dy) > 4) {
          dragStartPosRef.current.moved = true;
        }
        d.fx = event.x;
        d.fy = event.y;
        if (!simulationRef.current) {
          d.x = event.x;
          d.y = event.y;
          ticked();
        }
      })
      .on("end", (event, d) => {
        if (simulationRef.current) {
          simulationRef.current.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }
        if (typeof d.x === "number" && typeof d.y === "number") {
          prevPositionsRef.current.set(d.id, { x: d.x, y: d.y, vx: 0, vy: 0 });
        }
      });

    nodeElements.call(dragBehavior);

    let lastRenderedAt = 0;
    const ticked = () => {
      const now = performance.now();
      if (now - lastRenderedAt < 30) return;
      lastRenderedAt = now;
      linkElements.attr("d", computeEdgePath);
      linkLabelElements.attr("transform", computeEdgeLabelTransform);
      nodeElements.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
      nodeLabelElements.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
    };

    if (simulationRef.current) {
      simulationRef.current.on("tick", ticked).on("end", () => {
        simNodes.forEach((node) => {
          if (typeof node.x === "number" && typeof node.y === "number") {
            prevPositionsRef.current.set(node.id, { x: node.x, y: node.y, vx: 0, vy: 0 });
          }
        });
        lastRenderedAt = 0;
        ticked();
        if (!userAdjustedViewRef.current) fitView(70, 300);
      }).restart();
    } else {
      lastRenderedAt = 0;
      ticked();
    }

    nodeElements.on("click", (event, d) => {
      event.stopPropagation();
      if (dragStartPosRef.current.moved) return;
      selectNode(d.id);
      focusOnNeighborhoodRef.current?.(d.id, 80, 480);
    });

    linkElements.on("click", (event, d) => {
      event.stopPropagation();
      setSelectedEdgeData(d);
      selectNode(d.source.id);
    });

    // Node Selection Highlights & Dimming
    const applyHighlights = () => {
      const selectedId = activeSelectedIdRef.current;
      nodeLabelsGroup.attr("display", null);
      nodeLabelElements.attr("display", null);
      linkLabelsGroup.attr("display", null);
      if (!selectedId) {
        nodeElements
          .attr("opacity", 1)
          .select(".node-main-circle")
          .attr("stroke-width", 2.5)
          .attr("stroke", (d) => d.color)
          .attr("filter", "url(#kg-node-shadow)");

        nodeElements.selectAll(".node-selection-halo").attr("opacity", 0);
        nodeElements.selectAll(".node-selection-ring").attr("opacity", 0);
        nodeElements.selectAll(".node-neighbor-ring").attr("opacity", 0);

        nodeLabelElements.attr("opacity", 1);

        linkElements
          .attr("opacity", (d) => d.id === hoveredEdgeIdRef.current ? 0.96 : 0.58)
          .attr("stroke", (d) => d.id === hoveredEdgeIdRef.current ? "#526c7a" : "#8799a6")
          .attr("stroke-width", (d) => d.id === hoveredEdgeIdRef.current ? 1.9 : 1.25)
          .attr("stroke-dasharray", "none")
          .attr("marker-end", "url(#kg-arrow-default)");

        linkLabelElements
          .attr("opacity", (d) => d.id === hoveredEdgeIdRef.current ? 1 : 0)
          .select("rect")
          .attr("stroke", "#cbd5e1")
          .attr("stroke-width", 1);
        linkLabelElements.select("text").attr("fill", "#405a68").text((d) => d.label);
        return;
      }

      const targetCenterNode = simNodes.find((n) => n.id === selectedId);
      if (!targetCenterNode) return;

      const neighborhoodDistances = new Map<string, number>([[selectedId, 0]]);
      let frontier = [selectedId];
      for (let depth = 0; depth < hopDepthRef.current; depth += 1) {
        const nextFrontier: string[] = [];
        frontier.forEach((nodeId) => {
          (visibleAdjacencyByNode.get(nodeId) || []).forEach(({ otherId }) => {
            if (!neighborhoodDistances.has(otherId)) {
              neighborhoodDistances.set(otherId, depth + 1);
              nextFrontier.push(otherId);
            }
          });
        });
        frontier = nextFrontier;
      }

      const neighborhoodNodes = new Set(neighborhoodDistances.keys());
      const highlightedEdgeIds = new Set<string>();
      const directEdgeIds = new Set<string>();
      const outgoingEdgeIds = new Set<string>();
      const incomingEdgeIds = new Set<string>();
      const directNeighbors = new Set<string>();

      (visibleAdjacencyByNode.get(selectedId) || []).forEach(({ otherId }) => directNeighbors.add(otherId));

      simLinks.forEach((e) => {
        const sId = e.source.id;
        const tId = e.target.id;
        if (neighborhoodNodes.has(sId) && neighborhoodNodes.has(tId)) {
          highlightedEdgeIds.add(e.id);
        }
        if (sId === selectedId) {
          directEdgeIds.add(e.id);
          outgoingEdgeIds.add(e.id);
          directNeighbors.add(tId);
        } else if (tId === selectedId) {
          directEdgeIds.add(e.id);
          incomingEdgeIds.add(e.id);
          directNeighbors.add(sId);
        }
      });

      nodeElements
        .attr("opacity", (d) => {
          if (neighborhoodNodes.has(d.id)) return 1.0;
          return 0.14;
        })
        .select(".node-main-circle")
        .attr("stroke-width", (d) => {
          if (d.id === selectedId) return 5.0;
          if (neighborhoodNodes.has(d.id)) return 3.6;
          return 1.2;
        })
        .attr("stroke", (d) => {
          if (d.id === selectedId) return "#a34743";
          if (neighborhoodNodes.has(d.id)) return d.color;
          return "#cbd5e1";
        })
        .attr("filter", (d) => (d.id === selectedId ? "url(#kg-selected-glow)" : "url(#kg-node-shadow)"));

      nodeElements.selectAll(".node-selection-halo").attr("opacity", (d: any) => (d.id === selectedId ? 1 : 0));
      nodeElements.selectAll(".node-selection-ring").attr("opacity", (d: any) => (d.id === selectedId ? 1 : 0));
      nodeElements.selectAll(".node-neighbor-ring").attr("opacity", (d: any) => (neighborhoodNodes.has(d.id) && d.id !== selectedId ? 1 : 0));

      nodeElements.filter((d) => d.id === selectedId).raise();

      nodeLabelElements.attr("opacity", (d) => {
        if (d.id === selectedId || directNeighbors.has(d.id)) return 1.0;
        return 0.12;
      });
      nodeLabelElements.filter((d) => d.id === selectedId).raise();

      linkElements
        .attr("opacity", (d) => (directEdgeIds.has(d.id) ? 0.96 : highlightedEdgeIds.has(d.id) ? 0.58 : 0.045))
        .attr("stroke", (d) => {
          if (outgoingEdgeIds.has(d.id)) return "#914f45";
          if (incomingEdgeIds.has(d.id)) return "#397c80";
          if (highlightedEdgeIds.has(d.id)) return "#8395a1";
          return "#cbd5e1";
        })
        .attr("stroke-width", (d) => (directEdgeIds.has(d.id) ? 2.2 : highlightedEdgeIds.has(d.id) ? 1.2 : 0.8))
        .attr("stroke-dasharray", "none")
        .attr("marker-end", (d) => {
          if (outgoingEdgeIds.has(d.id)) return "url(#kg-arrow-connected-out)";
          if (incomingEdgeIds.has(d.id)) return "url(#kg-arrow-connected-in)";
          return highlightedEdgeIds.has(d.id) ? "url(#kg-arrow-default)" : null;
        });

      linkElements.filter((d) => highlightedEdgeIds.has(d.id)).raise();

      linkLabelElements.each(function (d) {
        const el = d3.select(this);
        const isDirect = directEdgeIds.has(d.id);
        const isHovered = d.id === hoveredEdgeIdRef.current;
        const isOut = outgoingEdgeIds.has(d.id);
        const isIn = incomingEdgeIds.has(d.id);

        if (isDirect || isHovered) {
          const rawType = d.label || d.relationship_type || "";
          const dirText = isOut ? `${rawType} →` : isIn ? `← ${rawType}` : `· ${rawType}`;
          const textWidth = Math.max(48, dirText.length * 7.4 + 20);

          el.attr("opacity", 1.0).raise();
          el.select("rect")
            .attr("stroke", isOut ? "#914f45" : isIn ? "#397c80" : "#718340")
            .attr("stroke-width", 1.8)
            .attr("x", -textWidth / 2)
            .attr("width", textWidth);
          el.select("text")
            .attr("fill", isOut ? "#783d39" : isIn ? "#28595c" : "#405a68")
            .attr("font-weight", "700")
            .text(dirText);
        } else {
          el.attr("opacity", 0);
        }
      });
    };

    linkElements
      .on("pointerenter", (_event, edge) => {
        hoveredEdgeIdRef.current = edge.id;
        linkLabelsGroup.attr("display", null);
        linkElements
          .filter((candidate) => candidate.id === edge.id)
          .raise()
          .attr("opacity", 1)
          .attr("stroke", "#526c7a")
          .attr("stroke-width", 1.9);
        applyHighlights();
      })
      .on("pointerleave", () => {
        hoveredEdgeIdRef.current = null;
        applyHighlights();
      });

    applyHighlightsRef.current = applyHighlights;
    applyHighlights();

    const fitTimer = setTimeout(() => {
      fitView(65, 300);
    }, 160);

    let resizeTimer: number | null = null;
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries.length) return;
      const { width: newW, height: newH } = entries[0].contentRect;
      if (newW <= 0 || newH <= 0) return;

      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (simulationRef.current) {
          simulationRef.current
            .force("center", d3.forceCenter(newW / 2, newH / 2).strength(0.025))
            .force("x", d3.forceX(newW / 2).strength(0.012))
            .force("y", d3.forceY(newH / 2).strength(0.012));
        }
        fitView(65, 200);
      }, 150);
    });

    resizeObserver.observe(container);

    return () => {
      clearTimeout(fitTimer);
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      if (simulationRef.current) {
        simNodes.forEach((node) => {
          if (typeof node.x === "number" && typeof node.y === "number") {
            prevPositionsRef.current.set(node.id, { x: node.x, y: node.y, vx: node.vx || 0, vy: node.vy || 0 });
          }
        });
        simulationRef.current.stop();
        simulationRef.current.on("tick", null);
        simulationRef.current.on("end", null);
        simulationRef.current = null;
      }
      zoomBehavior.on("zoom", null);
      svg.on(".zoom", null);
      d3.select(svgEl).interrupt();
      svg.on("click", null);
      nodeElements.on(".drag", null).on("click", null);
      linkElements.on("click", null).on("pointerenter", null).on("pointerleave", null);
      if (applyHighlightsRef.current === applyHighlights) applyHighlightsRef.current = null;
    };
  }, [filteredNodes, filteredLinks, visibleAdjacencyByNode, currentLayout, selectNode, fitView]);

  useEffect(() => {
    applyHighlightsRef.current?.();
  }, [activeSelectedId, hopDepth]);

  useEffect(() => {
    if (activeSelectedId && !filteredNodes.some((node) => node.id === activeSelectedId)) {
      selectNode(null);
    }
  }, [activeSelectedId, filteredNodes, selectNode]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  const resetAllFilters = useCallback(() => {
    setSelectedCategoryFilter("ALL");
    setSelectedRelFilter("ALL");
    setSelectedHierarchyFilter("ALL");
    selectNode(null);
    fitView(65, 350);
  }, [selectNode, fitView]);

  return (
    <div ref={containerRef} className="kg-card-container">
      {/* 1. Header Bar (Image 2) */}
      <div className="kg-card-title-bar">
        <div className="kg-card-branding">
          <div className="kg-card-icon-box">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h2 className="kg-card-title">KNOWLEDGE GRAPH VIEWER</h2>
          </div>
          <span className={`kg-status-badge ${backend === "neo4j" ? "online" : "online"}`}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#059669",
                display: "inline-block",
              }}
            />
            {backend === "neo4j" ? "Neo4j Aura" : "Validated Source Graph"}
          </span>
        </div>
      </div>

      {/* 2. Toolbar: Filters & Layout Controls (Image 2) */}
      <div className="kg-card-toolbar">
        {/* Left Filter Pills */}
        <div className="kg-filter-group">
          {/* Entity Type Pill */}
          <div className="kg-pill-select-wrapper">
            <Filter className="kg-select-icon" style={{ color: "#7c3aed" }} />
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="kg-pill-select purple"
              title="Filter by Entity Type"
            >
              <option value="ALL">All Entity Types ({normalizedNodes.length})</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_STYLES[cat as EntityCategory]?.label || cat}
                </option>
              ))}
            </select>
            <ChevronDown className="kg-select-chevron" />
          </div>

          {/* Relationship Pill */}
          <div className="kg-pill-select-wrapper">
            <Share2 className="kg-select-icon" style={{ color: "#4f46e5" }} />
            <select
              value={selectedRelFilter}
              onChange={(e) => setSelectedRelFilter(e.target.value)}
              className="kg-pill-select indigo"
              title="Filter by Relationship Type"
            >
              <option value="ALL">All Relationships ({normalizedLinks.length})</option>
              {availableRelationshipTypes.map((rel) => (
                <option key={rel} value={rel}>
                  {rel.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <ChevronDown className="kg-select-chevron" />
          </div>

          {/* Hierarchy Pill */}
          <div className="kg-pill-select-wrapper">
            <Layers className="kg-select-icon" style={{ color: "#059669" }} />
            <select
              value={selectedHierarchyFilter}
              onChange={(e) => setSelectedHierarchyFilter(e.target.value)}
              className="kg-pill-select emerald"
              title="Filter by Hierarchy Level"
            >
              <option value="ALL">All Hierarchy</option>
              <option value="Kandam">Kaṇḍam Level</option>
              <option value="Literary structure">Literary Structure</option>
              <option value="Passage">Passage Level</option>
              <option value="Entity">Entity Level</option>
              <option value="Event">Event Level</option>
            </select>
            <ChevronDown className="kg-select-chevron" />
          </div>
        </div>

        {/* Right Controls: Layout & Hops */}
        <div className="kg-filter-group">
          {/* Layout Selector */}
          <div className="kg-pill-select-wrapper">
            <Compass className="kg-select-icon" style={{ color: "#475569" }} />
            <select
              value={currentLayout}
              onChange={(e) => setCurrentLayout(e.target.value as any)}
              className="kg-pill-select"
              title="Select Layout Algorithm"
            >
              <option value="force">Force-Directed (Physics)</option>
              <option value="hierarchical">Hierarchical (Tiers)</option>
              <option value="radial">Concentric (Radial)</option>
            </select>
            <ChevronDown className="kg-select-chevron" />
          </div>

          {/* Hops Segmented Control */}
          {onChangeHopDepth && (
            <div className="kg-hops-control">
              <span className="kg-hops-label">HOPS:</span>
              <button
                type="button"
                className={`kg-hop-btn ${hopDepth === 1 ? "active" : ""}`}
                onClick={() => onChangeHopDepth(1)}
              >
                1
              </button>
              <button
                type="button"
                className={`kg-hop-btn ${hopDepth === 2 ? "active" : ""}`}
                onClick={() => onChangeHopDepth(2)}
              >
                2
              </button>
            </div>
          )}

          {/* Reset Filters */}
          {(selectedCategoryFilter !== "ALL" ||
            selectedRelFilter !== "ALL" ||
            selectedHierarchyFilter !== "ALL" ||
            activeSelectedId) && (
            <button type="button" onClick={resetAllFilters} className="kg-reset-btn" title="Reset all filters">
              <RotateCcw style={{ width: 11, height: 11 }} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Active Query Subgraph Info Bar (Image 2) */}
      <div className="kg-subgraph-bar">
        <div className="kg-subgraph-left">
          <span className="kg-subgraph-tag">Active Query Subgraph</span>
          <span className="kg-subgraph-query tamil-font">
            {activeQueryString ? `"${activeQueryString}"` : '"சிலப்பதிகாரம் காப்பியம் - ஆய்வு முனையங்கள்"'}
          </span>
        </div>

        <div className="kg-subgraph-badges">
          <span className="kg-stat-pill purple">
            <span>●</span>
            <b>{filteredNodes.length} Nodes</b>
          </span>
          <span className="kg-stat-pill indigo">
            <span>⑂</span>
            <b>{filteredLinks.length} Relationships</b>
          </span>
          <span className="kg-stat-pill emerald">
            <span>☆</span>
            <b>{selectedNode ? directConnections.length : Math.min(filteredNodes.length, 12)} Direct Links</b>
          </span>
          <span className="kg-stat-pill amber">
            <BookOpen style={{ width: 11, height: 11 }} />
            <span>Canonical Tamil Corpus</span>
          </span>
        </div>
      </div>

      {/* 4. Main Workspace (Canvas + Inspector Side Drawer) */}
      <div
        className="kg-workspace-layout"
        style={{ gridTemplateColumns: `minmax(0, 1fr) 12px ${inspectorWidth}px` }}
      >
        {/* Canvas Area */}
        <div ref={canvasRef} className="kg-canvas-container">
          <div className="kg-dot-grid" />
          <svg ref={svgRef} />

          {/* Floating HUD Pill (Image 2) */}
          <div className="kg-floating-hud">
            <button type="button" onClick={() => fitView(65, 350)} className="kg-hud-btn" title="Fit graph to view">
              <RefreshCw style={{ width: 11, height: 11 }} />
              <span>Fit View</span>
            </button>
            <div className="kg-hud-divider" />
            <button
              type="button"
              onClick={() => {
                if (svgRef.current && zoomBehaviorRef.current) {
                  d3.select(svgRef.current).interrupt().call(zoomBehaviorRef.current.scaleBy, 0.8);
                }
              }}
              className="kg-hud-btn"
              title="Zoom out"
            >
              <ZoomOut style={{ width: 13, height: 13 }} />
            </button>
            <span className="kg-hud-zoom-text">{zoomLevelPercent}%</span>
            <button
              type="button"
              onClick={() => {
                if (svgRef.current && zoomBehaviorRef.current) {
                  d3.select(svgRef.current).interrupt().call(zoomBehaviorRef.current.scaleBy, 1.25);
                }
              }}
              className="kg-hud-btn"
              title="Zoom in"
            >
              <ZoomIn style={{ width: 13, height: 13 }} />
            </button>
            <div className="kg-hud-divider" />
            <button
              type="button"
              onClick={() => {
                if (activeSelectedId) {
                  focusOnNeighborhood(activeSelectedId, 80, 500);
                }
              }}
              disabled={!activeSelectedId}
              className="kg-hud-btn"
              title="Center selected node in view"
            >
              <Crosshair style={{ width: 13, height: 13 }} />
            </button>
            <button type="button" onClick={toggleFullscreen} className="kg-hud-btn" title="Toggle fullscreen">
              {isFullscreen ? (
                <Minimize2 style={{ width: 13, height: 13 }} />
              ) : (
                <Maximize2 style={{ width: 13, height: 13 }} />
              )}
            </button>
          </div>

          {/* Canvas Hint */}
          <div className="kg-canvas-hint">
            {activeSelectedId ? (
              <span>
                Focused on <b>{selectedNode?.name_english || activeSelectedId}</b> · Connected nodes highlighted
              </span>
            ) : (
              <span>Select any circular node to focus its neighborhood. Drag nodes to reposition.</span>
            )}
          </div>
        </div>

        <button
          type="button"
          className={`kg-resizer${isResizingInspector ? " active" : ""}`}
          role="separator"
          aria-label="Resize graph and relationship panel"
          aria-valuemin={340}
          aria-valuemax={620}
          aria-valuenow={Math.round(inspectorWidth)}
          onPointerDown={(event) => {
            event.preventDefault();
            setIsResizingInspector(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") adjustInspectorWidth(20);
            if (event.key === "ArrowRight") adjustInspectorWidth(-20);
          }}
          title="Drag to resize the relationship panel"
        >
          <span aria-hidden="true">⋮</span>
        </button>

        {/* 5. Inspector Side Drawer with Tabs (Details & Triples from Image 3) */}
        <aside className="kg-inspector-drawer">
          {/* Tabs */}
          <div className="kg-inspector-tabs">
            <button
              type="button"
              className={`kg-tab-btn ${activeTab === "details" ? "active" : ""}`}
              onClick={() => setActiveTab("details")}
            >
              Node Details
            </button>
            <button
              type="button"
              className={`kg-tab-btn ${activeTab === "triples" ? "active" : ""}`}
              onClick={() => setActiveTab("triples")}
            >
              Relationships ({activeTriples.length})
            </button>
          </div>

          <div className="kg-inspector-content">
            {activeTab === "details" ? (
              selectedNode ? (
                <>
                  {/* Category Badge & Close */}
                  <div className="kg-node-card-header">
                    <span
                      className="kg-category-badge"
                      style={{
                        backgroundColor: CATEGORY_STYLES[selectedNode.category]?.badgeBg,
                        color: CATEGORY_STYLES[selectedNode.category]?.badgeText,
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          backgroundColor: CATEGORY_STYLES[selectedNode.category]?.stroke,
                        }}
                      />
                      {CATEGORY_STYLES[selectedNode.category]?.label || selectedNode.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => selectNode(null)}
                      className="kg-close-btn"
                      title="Clear selection"
                    >
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  </div>

                  {/* Title */}
                  <div className="kg-node-title-group">
                    <h2>{selectedNode.name_english || selectedNode.event_name_english || selectedNode.id}</h2>
                    {selectedNode.name_tamil && (
                      <p className="tamil-font tamil-title" lang="ta">
                        {selectedNode.name_tamil}
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  {selectedNode.description && <p className="kg-node-description">{selectedNode.description}</p>}

                  {/* Actions */}
                  <div className="kg-node-actions">
                    {onExpandNeighborhood && (
                      <button
                        type="button"
                        onClick={() => onExpandNeighborhood(selectedNode.id)}
                        disabled={isExpanding}
                        className="kg-action-btn-primary"
                      >
                        <RefreshCw
                          style={{ width: 13, height: 13 }}
                          className={isExpanding ? "animate-spin" : ""}
                        />
                        <span>{isExpanding ? "Expanding…" : "Expand Connections (+)"}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => focusOnNeighborhood(selectedNode.id, 80, 500)}
                      className="kg-action-btn-secondary"
                    >
                      Center
                    </button>
                  </div>

                  {/* Metadata Grid */}
                  <div className="kg-meta-grid">
                    <div className="kg-meta-item">
                      <span className="label">Node ID</span>
                      <span className="value">{selectedNode.id}</span>
                    </div>
                    <div className="kg-meta-item">
                      <span className="label">Type</span>
                      <span className="value">
                        {selectedNode.node_type}
                        {selectedNode.entity_type ? ` · ${selectedNode.entity_type}` : ""}
                      </span>
                    </div>
                    {selectedNode.kandam && (
                      <div className="kg-meta-item">
                        <span className="label">Kaṇḍam</span>
                        <span className="value">{selectedNode.kandam}</span>
                      </div>
                    )}
                    {selectedNode.section_number && (
                      <div className="kg-meta-item">
                        <span className="label">Section</span>
                        <span className="value">
                          {selectedNode.section_number}: {selectedNode.section_name || "—"}
                        </span>
                      </div>
                    )}
                    {selectedNode.source_file && (
                      <div className="kg-meta-item">
                        <span className="label">Source</span>
                        <span className="value">{selectedNode.source_file}{selectedNode.source_page_start ? ` · pp. ${selectedNode.source_page_start}-${selectedNode.source_page_end || selectedNode.source_page_start}` : ""}</span>
                      </div>
                    )}
                  </div>

                  {/* Direct Relationships */}
                  <div>
                    <span
                      style={{
                        display: "block",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#334155",
                        marginBottom: 6,
                      }}
                    >
                      Direct Connections ({directConnections.length})
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                      {directConnections.map(({ edge, node, outward }, idx) => (
                        <button
                          key={`${edge.id}-${idx}`}
                          type="button"
                          onClick={() => selectNode(node.id)}
                          className="kg-connection-button"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 10px",
                            borderRadius: 6,
                            border: "1px solid #e2e8f0",
                            background: "#f8fafc",
                            textAlign: "left",
                            cursor: "pointer",
                            fontSize: 11,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "ui-monospace, monospace",
                              fontWeight: 700,
                              color: outward ? "#914f45" : "#397c80",
                            }}
                          >
                            {outward ? "→" : "←"}
                          </span>
                          <span style={{ fontWeight: 600, color: "#1e293b", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {node.name_english || node.name_tamil || node.id}
                          </span>
                          <span style={{ color: "#94a3b8", fontSize: 10 }}>
                            {edge.relationship_type.replace(/_/g, " ")}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="kg-inspector-empty">
                  <div className="kg-inspector-empty-icon">
                    <Network style={{ width: 24, height: 24 }} />
                  </div>
                  <h3>Node Inspector</h3>
                  <p>
                    Select any circular node to inspect its Tamil title, literary classification, provenance citations,
                    and topological connections.
                  </p>
                </div>
              )
            ) : (
              /* Tab 2: Relationships and their source evidence */
              <div className="kg-triples-container">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingBottom: 6,
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>
                    Relationships ({activeTriples.length})
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      background: "#edf0ee",
                      color: "#45504a",
                      border: "1px solid #dfe5e1",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    Graph records
                  </span>
                </div>

                {activeTriples.map((t, idx) => (
                  <div key={`${t.id}-${idx}`} className="kg-triple-card">
                    <div className="kg-triple-chain">
                      <span className="kg-triple-node-text">{t.subject}</span>
                      <div className="kg-triple-predicate-box">
                        <ArrowRight style={{ width: 12, height: 12, color: CATEGORY_STYLES[t.subjectCategory as EntityCategory]?.stroke || CATEGORY_STYLES.Entity.stroke }} />
                        <span className="kg-triple-predicate-tag">{t.predicate}</span>
                        <ArrowRight style={{ width: 12, height: 12, color: CATEGORY_STYLES[t.objectCategory as EntityCategory]?.stroke || CATEGORY_STYLES.Entity.stroke }} />
                      </div>
                      <span className="kg-triple-node-text">{t.object}</span>
                    </div>
                    {t.evidence && <p className="kg-triple-evidence">{t.evidence}</p>}
                    <p className="kg-triple-citation">
                      {t.relationshipId}{t.passageId ? ` · ${t.passageId}` : ""}
                      {t.sourceFile ? ` · ${t.sourceFile}` : ""}
                      {t.pageStart ? ` · pp. ${t.pageStart}-${t.pageEnd || t.pageStart}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* 6. Bottom Legend Bar (Image 2) */}
      <div className="kg-legend-container">
        <div className="kg-legend-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="kg-legend-title-badge">
              GRAPH NOTATIONS & ONTOLOGICAL LEGEND (குறிகள் விளக்கம்)
            </span>
            <span className="kg-legend-subtitle">
              Node categories and relationship types present in the current graph
            </span>
          </div>
        </div>

        <div className="kg-legend-grid">
          {/* Column A: Node Taxonomy */}
          <div className="kg-legend-column">
            <span className="kg-legend-column-title">Node Taxonomy (முனைய வகைகள்):</span>
            <div className="kg-legend-pills-row">
              {(Object.keys(CATEGORY_STYLES) as EntityCategory[]).map((catKey) => {
                const cat = CATEGORY_STYLES[catKey];
                const isSelected = selectedCategoryFilter === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(isSelected ? "ALL" : catKey)}
                    className={`kg-legend-item-pill ${isSelected ? "active" : ""}`}
                  >
                    <span
                      className="kg-legend-circle-dot"
                      style={{ backgroundColor: cat.stroke }}
                    />
                    <b>{cat.label}</b>
                    <span className="kg-legend-tamil-sub tamil-font">({cat.tamilLabel})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Column B: Relationship & Edge Notations */}
          <div className="kg-legend-column">
            <span className="kg-legend-column-title">Relationship & Edge Notations (இணைப்புக் குறிகள்):</span>
            <div className="kg-legend-pills-row">
              {availableRelationshipTypes.map((relationshipType) => (
                <div className="kg-legend-item-pill" key={relationshipType}>
                  <span className="kg-legend-edge-arrow" aria-hidden="true">──▶</span>
                  <b>{relationshipType.replace(/_/g, " ")}</b>
                </div>
              ))}
              <div className="kg-legend-item-pill"><span className="kg-legend-selection-ring" /><b>Selected node</b></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
