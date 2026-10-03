/**
 * 会場グラフ（graph）＋ graphical_info（guide-map-poc の書き出し）を合成して、
 * ゲスト向けの道案内に使うモデルを作る。
 *
 * 方針 A: 座標は px のまま持ち、方角は実行時に計算する（north を基準に）。
 *   - points/routes は graph 由来地点の「見た目・曲がり角」
 *   - extraPoints/extraRoutes は作成ツールで追加した地点・道
 */

import type { GuideMapPoint } from "./guideMapSchema";

export type NavNodeType =
  | "GOAL"
  | "GOAL_TRANSIT_MIXED"
  | "TRANSIT_ONLY"
  | "BOUNDARY";

type Vec = { x: number; y: number };
type Shape = "rect" | "circle";

// --- 会場グラフ（guide-map-poc 書き出し互換の最小型） ---
type GraphGroupNode = {
  id: string;
  type: "graphGroup";
  position: Vec;
  width?: number;
  height?: number;
  data: { labels: Record<string, string> };
};
type GraphPointNode = {
  id: string;
  type?: string;
  parentId?: string;
  position: Vec;
  data: { labels: Record<string, string>; nodeType: NavNodeType };
};
type GraphNode = GraphGroupNode | GraphPointNode;
type GraphEdge = {
  id: string;
  source: string;
  target: string;
  data?: { direction?: "both" | "oneway"; label?: string };
};
export type GraphData = { nodes: GraphNode[]; edges: GraphEdge[] };

// --- graphical_info.json ---
export type GraphicalInfo = {
  version?: number;
  north?: number;
  points?: Record<
    string,
    { x: number; y: number; w: number; h: number; shape: Shape }
  >;
  routes?: Record<string, { anchors?: Vec[] }>;
  extraPoints?: {
    id: string;
    label: string;
    type: NavNodeType;
    floor: string;
    x: number;
    y: number;
    w: number;
    h: number;
    shape: Shape;
  }[];
  extraRoutes?: {
    id: string;
    source: string;
    target: string;
    direction: "both" | "oneway";
    label?: string;
    anchors?: Vec[];
  }[];
};

export type NavNode = {
  id: string;
  label: string;
  type: NavNodeType;
  floor: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: Shape;
};
export type NavEdge = {
  id: string;
  source: string;
  target: string;
  direction: "both" | "oneway";
  label?: string;
  anchors: Vec[];
};
export type NavModel = {
  floors: { id: string; name: string }[];
  nodes: NavNode[];
  edges: NavEdge[];
  /** マップの上が指す方位角（0=北・時計回り）。方角計算の基準。 */
  north: number;
  goals: NavNode[];
  /** 出発点の候補（入口・出口を先頭に、続けてその他） */
  starts: NavNode[];
};

const DEF_W = 140;
const DEF_H = 56;

function resolveLabel(labels: Record<string, string>, locale: string): string {
  if (labels[locale]) return labels[locale];
  for (const k of [locale, "ja", "en", ...Object.keys(labels)]) {
    if (labels[k]) return labels[k];
  }
  return "";
}
function isGroup(n: GraphNode): n is GraphGroupNode {
  return n.type === "graphGroup";
}

/** graph + graphical_info を合成してナビ用モデルを作る */
export function buildNav(
  graph: GraphData,
  info: GraphicalInfo,
  locale = "ja",
): NavModel {
  const groups = graph.nodes.filter(isGroup);
  const points = graph.nodes.filter((n): n is GraphPointNode => !isGroup(n));
  const floors = groups.map((g) => ({
    id: g.id,
    name: resolveLabel(g.data.labels, locale) || g.id,
  }));

  const nodes: NavNode[] = points.map((p) => {
    const g = info.points?.[p.id];
    return {
      id: p.id,
      label: resolveLabel(p.data.labels, locale) || p.id,
      type: p.data.nodeType,
      floor: p.parentId ?? "",
      x: g?.x ?? p.position.x,
      y: g?.y ?? p.position.y,
      w: g?.w ?? DEF_W,
      h: g?.h ?? DEF_H,
      shape: g?.shape ?? "rect",
    };
  });
  for (const ep of info.extraPoints ?? []) {
    nodes.push({
      id: ep.id,
      label: ep.label,
      type: ep.type,
      floor: ep.floor,
      x: ep.x,
      y: ep.y,
      w: ep.w ?? DEF_W,
      h: ep.h ?? DEF_H,
      shape: ep.shape ?? "rect",
    });
  }

  const edges: NavEdge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    direction: e.data?.direction ?? "both",
    label: e.data?.label,
    anchors: info.routes?.[e.id]?.anchors ?? [],
  }));
  for (const er of info.extraRoutes ?? []) {
    edges.push({
      id: er.id,
      source: er.source,
      target: er.target,
      direction: er.direction,
      label: er.label,
      anchors: er.anchors ?? [],
    });
  }

  const goals = nodes.filter(
    (n) => n.type === "GOAL" || n.type === "GOAL_TRANSIT_MIXED",
  );
  const starts = [
    ...nodes.filter((n) => n.type === "BOUNDARY"),
    ...nodes.filter((n) => n.type !== "BOUNDARY"),
  ];
  return { floors, nodes, edges, north: info.north ?? 0, goals, starts };
}

/** start → goal の最短経路（ノード id 列）。both は双方向、oneway は source→target。 */
export function findPath(
  edges: NavEdge[],
  start: string,
  goal: string,
): string[] {
  if (start === goal) return [start];
  const adj = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    const l = adj.get(a);
    if (l) l.push(b);
    else adj.set(a, [b]);
  };
  for (const e of edges) {
    link(e.source, e.target);
    if (e.direction === "both") link(e.target, e.source);
  }
  const prev = new Map<string, string>();
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    if (cur === goal) break;
    for (const next of adj.get(cur) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      prev.set(next, cur);
      queue.push(next);
    }
  }
  if (!seen.has(goal)) return [];
  const path = [goal];
  let node = goal;
  while (node !== start) {
    const p = prev.get(node);
    if (p === undefined) return [];
    path.push(p);
    node = p;
  }
  return path.reverse();
}

/**
 * ルートのノード列 → コンパス用の折れ線（中心＋曲がり角）。
 * 同一フロアの区間はアンカー（曲がり角）を挟む。階またぎは中心同士でつなぐ。
 */
export function routePoints(
  model: NavModel,
  startId: string,
  goalId: string,
): GuideMapPoint[] {
  const path = findPath(model.edges, startId, goalId);
  if (path.length < 2) return [];
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  const pts: GuideMapPoint[] = [];
  const push = (p: GuideMapPoint) => {
    const last = pts[pts.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) pts.push(p);
  };
  const first = byId.get(path[0]);
  if (first) push({ x: first.x, y: first.y });
  for (let i = 0; i < path.length - 1; i++) {
    const a = byId.get(path[i]);
    const b = byId.get(path[i + 1]);
    if (!a || !b) continue;
    const edge = model.edges.find(
      (e) =>
        (e.source === a.id && e.target === b.id) ||
        (e.source === b.id && e.target === a.id),
    );
    let anchors = edge?.anchors ?? [];
    if (edge && edge.source === b.id) anchors = [...anchors].reverse();
    if (a.floor === b.floor) {
      for (const an of anchors) push(an);
    }
    push({ x: b.x, y: b.y });
  }
  return pts;
}
