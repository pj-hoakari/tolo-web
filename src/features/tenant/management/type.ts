import type { Edge, Node } from "@xyflow/react";

/** ノードの4辺。各辺に複数のハンドル（接続点）を配置する。 */
export type HandleSide = "top" | "right" | "bottom" | "left";

/** 1つのハンドル（エッジの接続点）を表すレンダリング用スロット。 */
export type HandleSlot = {
  id: string;
  side: HandleSide;
  index: number;
  /** すでにエッジに使用されているか。 */
  used: boolean;
  /** 同じ辺上のスロット総数（座標計算に使用）。 */
  total: number;
};

export type NodeHandles = Record<HandleSide, HandleSlot[]>;

export type GraphNodeData = {
  label: string;
  /**
   * エッジ接続状況から派生的に注入されるレンダリング情報。
   * 永続化対象には含めない。
   */
  handles?: NodeHandles;
};

/**
 * エッジ（有向の通路）の付加情報。
 * プロパティ編集 UI は今は持たないため最小限。後から拡張する。
 */
export type GraphEdgeData = {
  label?: string;
};

export type GraphNodeType = Node<GraphNodeData, "graph">;
export type GraphEdgeType = Edge<GraphEdgeData, "graph">;
