import type { Edge, Node } from "@xyflow/react";

/** ノードの4辺。各辺に複数のハンドル（接続点）を配置 */
export type HandleSide = "top" | "right" | "bottom" | "left";

/** 1つのハンドル（エッジの接続点）を表すレンダリング用スロット */
export type HandleSlot = {
  id: string;
  side: HandleSide;
  index: number;
  used: boolean;
  /** 同じ辺上のスロット総数（座標計算に使用） */
  total: number;
};

export type NodeHandles = Record<HandleSide, HandleSlot[]>;

export type NodeType =
  | "GOAL"
  | "GOAL_TRANSIT_MIXED"
  | "TRANSIT_ONLY"
  | "BOUNDARY";

export type GraphNodeData = {
  label: string;
  nodeType: NodeType;
  /**
   * エッジ接続状況から派生的に注入されるレンダリング情報
   */
  handles?: NodeHandles;
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
};

export type GraphNodeType = Node<GraphNodeData, "graph">;
export type GraphEdgeType = Edge<GraphEdgeData, "graph">;
