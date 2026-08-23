import type { ReactNode } from "react";
import { PLACEHOLDER_GRAPH } from "@/features/graph";
import type { ObservationPointsSource } from "@/features/tenant/management/graph/components/observation";
import {
  deriveNodeNotices,
  type NoticeTranslator,
} from "@/features/tenant/management/graph/nodeTypes";
import type {
  GraphEdgeType,
  GraphNodeType,
} from "@/features/tenant/management/graph/type";
import { isPointNode } from "@/features/tenant/management/graph/type";
import { deriveNodeLabels } from "@/features/tenant/management/graph/utils/labels";
import type { AliveEdge } from "@/features/tenant/webrtc/type";

// 表示言語で解決したラベル（data.label）を注入した描画用の形にそろえる
export const GRAPH_NODES = deriveNodeLabels(PLACEHOLDER_GRAPH.nodes, "ja");
export const GRAPH_EDGES = PLACEHOLDER_GRAPH.edges;

/**
 * 選択肢・方向状態を Story のモジュールスコープで組み立てるための翻訳関数。
 * フィクスチャでは制約違反が起きず理由が表示されないので、キーをそのまま返す。
 */
export const passThroughNotice: NoticeTranslator = (messageKey) => messageKey;

/** プレースホルダグラフからノードを取り出す（存在しない ID は Story の記述ミス） */
export function graphNode(id: string): GraphNodeType {
  const found = GRAPH_NODES.find((n) => n.id === id);
  if (!found || !isPointNode(found))
    throw new Error(`ポイントが見つかりません: ${id}`);
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
    // label は表示言語で解決済みの描画用フィールド（deriveNodeLabels が注入する形）
    data: {
      labels: { ja: "入退出口" },
      label: "入退出口",
      nodeType: "BOUNDARY",
    },
  },
  {
    id: "hall",
    type: "graph",
    position: { x: 300, y: 0 },
    data: {
      labels: { ja: "ホール" },
      label: "ホール",
      nodeType: "TRANSIT_ONLY",
    },
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
  if (!found || !isPointNode(found))
    throw new Error("入退出点が見つかりません");
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
