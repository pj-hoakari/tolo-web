import type { Edge, Node } from "@xyflow/react";
import type { NoticeMessageKey } from "./nodeTypes";

/** ノードの4辺。各辺に複数のハンドル（接続点）を配置 */
export type HandleSide = "top" | "right" | "bottom" | "left";

/** 接続済みエッジの端点を表す、描画時だけ使うハンドル */
export type HandleSlot = {
  id: string;
  side: HandleSide;
  index: number;
  /** 同じ辺上の端点総数（座標計算に使用） */
  total: number;
  /** 接続ドラッグ中だけ描画する仮想的な端点 */
  virtual?: boolean;
};

export type NodeHandles = Record<HandleSide, HandleSlot[]>;

export type NodeType =
  | "GOAL"
  | "GOAL_TRANSIT_MIXED"
  | "TRANSIT_ONLY"
  | "BOUNDARY";

/** 通知（強調表示）の重要度 */
export type NoticeLevel = "info" | "warning";

/**
 * 制約違反ではないが、利用者に強調して伝えたい状態を表す通知。
 * 接続状況などから派生的に算出され、描画時にノードデータへ注入される。
 */
export type GraphNotice = {
  level: NoticeLevel;
  /** `Graph.notices` 配下のメッセージキー。表示する箇所で翻訳する */
  messageKey: NoticeMessageKey;
};

export type GraphNodeData = {
  label: string;
  nodeType: NodeType;
  /**
   * 紐づけた観測点（接続エッジ）の ID 一覧。
   * ID は webrtc の接続エッジ（AliveEdge）の id に対応
   */
  observationPointIds?: string[];
  /**
   * 接続済みエッジの端点から派生的に注入されるレンダリング情報
   */
  handles?: NodeHandles;
  /**
   * 現在の接続状況から派生的に注入される通知（強調表示用）
   */
  notices?: GraphNotice[];
};

/** エッジ（通路）の通行方向。両通行可 / 片方向（source→target） */
export type EdgeDirection = "both" | "oneway";

/** エッジ（通路）の付加情報。プロパティパネルから編集 */
export type GraphEdgeData = {
  label?: string;
  /** 通行方向
   * 新規作成時の既定は "both"（両通行）
   */
  direction: EdgeDirection;
  /**
   * 紐づけた観測点（接続エッジ）の ID 一覧。
   * ID は webrtc の接続エッジ（AliveEdge）の id に対応
   */
  observationPointIds?: string[];
};

export type GraphNodeType = Node<GraphNodeData, "graph">;
export type GraphEdgeType = Edge<GraphEdgeData, "graph">;

export type GraphData = {
  nodes: GraphNodeType[];
  edges: GraphEdgeType[];
};
