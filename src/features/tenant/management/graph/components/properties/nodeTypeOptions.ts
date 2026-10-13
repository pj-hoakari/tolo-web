import {
  hasNodeTypeFlag,
  NODE_TYPE_FLAGS,
  type NodeTypeFlag,
  type NoticeTranslator,
  setNodeTypeFlag,
  validateAssignType,
} from "../../nodeTypes";
import type { GraphCanvasNode, GraphEdgeType, NodeType } from "../../type";

export type NodeTypeOption = {
  flag: NodeTypeFlag;
  checked: boolean;
  next: NodeType;
  assignable: boolean;
  disabledReason: string | null;
};

export function buildNodeTypeOptions(
  nodeId: string,
  currentType: NodeType,
  nodes: GraphCanvasNode[],
  edges: GraphEdgeType[],
  translateNotice: NoticeTranslator,
): NodeTypeOption[] {
  return NODE_TYPE_FLAGS.map((flag) => {
    const checked = hasNodeTypeFlag(currentType, flag);
    const next = setNodeTypeFlag(currentType, flag, !checked);
    const available =
      flag !== "destination" || hasNodeTypeFlag(currentType, "dwell");
    const result = validateAssignType(next, nodeId, nodes, edges);
    return {
      flag,
      checked,
      next,
      assignable: available && result.ok,
      disabledReason: result.ok ? null : translateNotice(result.messageKey),
    };
  });
}
