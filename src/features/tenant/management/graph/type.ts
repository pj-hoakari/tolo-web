import type { Edge, Node, NodeOrigin } from "@xyflow/react";
import type { NoticeMessageKey } from "./nodeTypes";

/**
 * ポイントノードのアンカー（origin）。position はノードの中心を指す。
 * 会場内の地点を表すポイントは、座標=ノード中央として扱う。
 * 描画時には deriveNodeHandles がポイントへ注入する。
 * グループコンテナは React Flow 既定の左上アンカーのまま。
 */
export const POINT_NODE_ORIGIN: NodeOrigin = [0.5, 0.5];

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

/**
 * 言語コード（ロケール）をキーにしたポイントラベルの対訳。
 * 各言語は並列に扱い、どの言語をいくつ設定するかは任意（特別扱いする言語はない）。
 * キーはアプリの対応ロケールを想定するが、保存済みデータとの互換のため文字列で扱う。
 */
export type LocalizedLabel = Record<string, string>;

export type GraphNodeData = {
  /** 言語ごとのラベル。永続化・API 送信の対象 */
  labels: LocalizedLabel;
  /**
   * 表示言語で解決されたラベル。描画時に deriveNodeLabels が注入する
   */
  label?: string;
  /**
   * label が表示言語のラベルではなく他言語からのフォールバックであることを示す。
   * 描画時に deriveNodeLabels が注入する
   */
  labelIsFallback?: boolean;
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

/**
 * 論理グルーピング（階・建物など）のコンテナノード。
 * UI 上の管理単位であり、エンジンへ渡すポイントではない。
 * ルートの端点にはならず、ネスト（グループ内グループ）できる。
 */
export type GroupNodeData = {
  /** 言語ごとのラベル。ポイントと同様に永続化・API 送信の対象 */
  labels: LocalizedLabel;
  /**
   * 表示言語で解決されたラベル。描画時に deriveNodeLabels が注入する
   */
  label?: string;
  /**
   * label が表示言語のラベルではなく他言語からのフォールバックであることを示す。
   * 描画時に deriveNodeLabels が注入する
   */
  labelIsFallback?: boolean;
  /**
   * 手動リサイズで指定した最小サイズ。
   * 実際の width / height は「子ノードへのフィット」とこの値の大きい方になる。
   */
  minWidth?: number;
  minHeight?: number;
};

export type GroupNodeType = Node<GroupNodeData, "graphGroup">;

/** キャンバスに置ける要素 = ポイント ∪ グループコンテナ */
export type GraphCanvasNode = GraphNodeType | GroupNodeType;

export function isGroupNode(node: GraphCanvasNode): node is GroupNodeType {
  return node.type === "graphGroup";
}

export function isPointNode(node: GraphCanvasNode): node is GraphNodeType {
  return node.type !== "graphGroup";
}

export type GraphData = {
  nodes: GraphCanvasNode[];
  edges: GraphEdgeType[];
};
