import type { XYPosition } from "@xyflow/react";
import type { GraphCanvasNode } from "../../type";

/** フロー軸。x = 左右へ流れる、y = 上下へ流れる */
export type Axis = "x" | "y";

/** コンテナ = グループ ID。undefined はキャンバス直下を表す */
export type ContainerId = string | undefined;

export type Size = { width: number; height: number };

/** コンテナ外の相手ノードのおおまかな方角 */
export type Direction = { axis: Axis; sign: number };

/** ノードの親子関係を引きやすくした索引 */
export type GraphIndex = {
  byId: Map<string, GraphCanvasNode>;
  /** コンテナ（undefined = キャンバス直下）→ 直下メンバー */
  childrenOf: Map<ContainerId, GraphCanvasNode[]>;
};

/** コンテナ直下のメンバーへ持ち上げたルート */
export type LiftedEdge = {
  /** source 側端点を含むメンバー */
  from: string;
  /** target 側端点を含むメンバー */
  to: string;
  /** 元のルートの端点（位置を揃える対象のポイント） */
  sourceId: string;
  targetId: string;
};

/** 連結成分ひとつ分の配置計画 */
export type PlannedComponent = {
  /** フロー軸に沿った列 → クロス軸方向に上（左）から順のメンバー ID */
  columns: string[][];
  /** クロス軸の手前側（上／左）の境界バンドに置くメンバー ID（主軸順） */
  bandStart: string[];
  /** クロス軸の奥側（下／右）の境界バンドに置くメンバー ID（主軸順） */
  bandEnd: string[];
};

/** コンテナごとの整列計画 */
export type ContainerPlan = {
  axis: Axis;
  components: PlannedComponent[];
  /** メンバー ID → 列番号（成分内で 0 始まり。バンド行きは含まない） */
  columnOf: Map<string, number>;
  /** メンバー ID → 列内の並び順 */
  orderOf: Map<string, number>;
  /** 境界バンド行きのメンバー ID → 側（-1: 手前 / 1: 奥） */
  bandOf: Map<string, number>;
  /** コンテナ内で完結するルート */
  internal: LiftedEdge[];
};

/** コンテナ内容の確定レイアウト（内容バウンディングボックスの左上が原点） */
export type FinalizedContent = {
  size: Size;
  /** 直下メンバー ID → 中心座標 */
  memberCenters: Map<string, XYPosition>;
  /** 直下メンバー ID → 占有ボックスサイズ */
  memberSizes: Map<string, Size>;
  /** 配下すべてのポイント ID → 中心座標 */
  pointCenters: Map<string, XYPosition>;
};
