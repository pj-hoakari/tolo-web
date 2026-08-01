import {
  NODE_TYPE_DEFS,
  type ValidationResult,
  validateAssignType,
} from "../../nodeTypes";
import type { GraphEdgeType, GraphNodeType, NodeType } from "../../type";

/** ノードタイプ選択肢1件分の選択可否 */
export type NodeTypeOption = {
  type: NodeType;
  /** このタイプに変更できるか（選択中のタイプは常に true） */
  assignable: boolean;
  /** 変更できない理由。変更できるときは null */
  disabledReason: string | null;
};

/**
 * 検証結果から選択肢1件分の表示状態を導出する。
 * 選択中のタイプは制約違反であっても操作を塞がないよう常に選択可能とする。
 */
export function deriveNodeTypeOption(
  type: NodeType,
  selected: boolean,
  result: ValidationResult,
): NodeTypeOption {
  const assignable = selected || result.ok;
  return {
    type,
    assignable,
    disabledReason: assignable ? null : result.message,
  };
}

/** 現在のグラフ状態から、各ノードタイプに変更できるかを解決する */
export function buildNodeTypeOptions(
  nodeId: string,
  currentType: NodeType,
  nodes: GraphNodeType[],
  edges: GraphEdgeType[],
): NodeTypeOption[] {
  return NODE_TYPE_DEFS.map((def) =>
    deriveNodeTypeOption(
      def.type,
      def.type === currentType,
      validateAssignType(def.type, nodeId, nodes, edges),
    ),
  );
}
