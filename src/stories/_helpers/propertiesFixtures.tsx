import type { ReactNode } from "react";
import type { ObservationPointsSource } from "@/features/tenant/management/graphEditor/components/properties";
import { deriveNodeNotices } from "@/features/tenant/management/graphEditor/nodeTypes";
import { PLACEHOLDER_GRAPH } from "@/features/tenant/management/graphEditor/placeholderGraph";
import type {
  GraphEdgeType,
  GraphNodeType,
} from "@/features/tenant/management/graphEditor/type";
import type { AliveEdge } from "@/features/tenant/webrtc/type";

export const GRAPH_NODES = PLACEHOLDER_GRAPH.nodes;
export const GRAPH_EDGES = PLACEHOLDER_GRAPH.edges;

/** プレースホルダグラフからノードを取り出す（存在しない ID は Story の記述ミス） */
export function graphNode(id: string): GraphNodeType {
  const found = GRAPH_NODES.find((n) => n.id === id);
  if (!found) throw new Error(`ノードが見つかりません: ${id}`);
  return found;
}

/** プレースホルダグラフからエッジを取り出す（存在しない ID は Story の記述ミス） */
export function graphEdge(id: string): GraphEdgeType {
  const found = GRAPH_EDGES.find((e) => e.id === id);
  if (!found) throw new Error(`ルートが見つかりません: ${id}`);
  return found;
}

/** 紐づけ候補となる観測点（接続中のエッジ）のサンプル */
export const OBSERVATION_POINTS: AliveEdge[] = [
  { id: "demo_event_cam-entrance", lastSeenAt: null },
  { id: "demo_event_cam-hall", lastSeenAt: null },
  { id: "demo_event_cam-booth-a", lastSeenAt: null },
];

/** 観測点ピッカーに渡すデータ一式（差分だけ上書きして使う） */
export function observationPointsSource(
  overrides: Partial<ObservationPointsSource> = {},
): ObservationPointsSource {
  return {
    available: OBSERVATION_POINTS,
    status: "ready",
    usedIds: new Set<string>(),
    ...overrides,
  };
}

// 入退出（入力・出力）の両方を担う入退出点。両通行ルートに接続することで
// 両方向のロールを持ち、info の通知が表示される。
export const DUAL_BOUNDARY_NODES: GraphNodeType[] = [
  {
    id: "gate",
    type: "graph",
    position: { x: 0, y: 0 },
    data: { label: "入退出口", nodeType: "BOUNDARY" },
  },
  {
    id: "hall",
    type: "graph",
    position: { x: 300, y: 0 },
    data: { label: "ホール", nodeType: "TRANSIT_ONLY" },
  },
];

export const DUAL_BOUNDARY_EDGES: GraphEdgeType[] = [
  {
    id: "de1",
    source: "gate",
    target: "hall",
    type: "graph",
    data: { direction: "both" },
  },
];

/** 通知が注入された状態の入退出点 */
export function dualBoundaryNode(): GraphNodeType {
  const derived = deriveNodeNotices(DUAL_BOUNDARY_NODES, DUAL_BOUNDARY_EDGES);
  const found = derived.find((n) => n.id === "gate");
  if (!found) throw new Error("入退出点が見つかりません");
  return found;
}

/** プロパティパネル内と同じ幅・背景で部品を描画する枠 */
export function PanelFrame({ children }: { children: ReactNode }) {
  return (
    <div className="w-72 border border-border bg-card p-4 text-foreground">
      {children}
    </div>
  );
}
