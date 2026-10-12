import {
  hasNodeTypeFlag,
  type NodeTypeFlag,
  type NoticeMessageKey,
  setNodeTypeFlag,
  validateAssignType,
  validateEdgeDirection,
  validateReverseEdge,
} from "../nodeTypes";
import type { EdgeDirection, GraphData } from "../type";
import { isExternalNode, isPointNode } from "../type";
import { patchEdgeData, reverseEdgeById } from "./graphMutations";

export type BulkPropertyAction =
  | { kind: "nodeFlag"; flag: NodeTypeFlag; enabled: boolean }
  | { kind: "edgeDirection"; direction: EdgeDirection }
  | { kind: "reverseEdges" };
export type BulkEditReason =
  | { kind: "operation"; messageKey: "requiresDwell" | "bothNotReversed" }
  | { kind: "notice"; messageKey: NoticeMessageKey };
export type BulkEditResult = {
  targetCount: number;
  changedCount: number;
  skippedCount: number;
  reasons: (BulkEditReason & { count: number })[];
};

export function commonValue<T>(values: T[]): T | null {
  return values.length > 0 && values.every((value) => value === values[0])
    ? values[0]
    : null;
}

/** 選択対象に順に適用し、理由のある対象だけを除外する。 */
export function applyBulkProperty(
  graph: GraphData,
  action: BulkPropertyAction,
): { graph: GraphData; result: BulkEditResult } {
  let next = graph;
  const result: BulkEditResult = {
    targetCount: 0,
    changedCount: 0,
    skippedCount: 0,
    reasons: [],
  };
  const skip = (reason: BulkEditReason) => {
    result.skippedCount++;
    const existing = result.reasons.find(
      (item) =>
        item.kind === reason.kind && item.messageKey === reason.messageKey,
    );
    if (existing) existing.count++;
    else result.reasons.push({ ...reason, count: 1 });
  };
  if (action.kind === "nodeFlag") {
    for (const node of graph.nodes) {
      if (!node.selected || !isPointNode(node) || isExternalNode(node))
        continue;
      result.targetCount++;
      const nextType = setNodeTypeFlag(
        node.data.nodeType,
        action.flag,
        action.enabled,
      );
      if (nextType === node.data.nodeType) continue;
      if (
        action.flag === "destination" &&
        !hasNodeTypeFlag(node.data.nodeType, "dwell")
      ) {
        skip({ kind: "operation", messageKey: "requiresDwell" });
        continue;
      }
      const validation = validateAssignType(
        nextType,
        node.id,
        next.nodes,
        next.edges,
      );
      if (!validation.ok) {
        skip({ kind: "notice", messageKey: validation.messageKey });
        continue;
      }
      next = {
        ...next,
        nodes: next.nodes.map((n) =>
          n.id === node.id && isPointNode(n)
            ? { ...n, data: { ...n.data, nodeType: nextType } }
            : n,
        ),
      };
      result.changedCount++;
    }
  } else {
    for (const edge of graph.edges) {
      if (!edge.selected) continue;
      result.targetCount++;
      const direction = edge.data?.direction ?? "both";
      if (action.kind === "edgeDirection" && direction === action.direction)
        continue;
      if (action.kind === "reverseEdges" && direction === "both") {
        skip({ kind: "operation", messageKey: "bothNotReversed" });
        continue;
      }
      const validation =
        action.kind === "edgeDirection"
          ? validateEdgeDirection(
              edge,
              action.direction,
              next.nodes,
              next.edges,
            )
          : validateReverseEdge(edge, next.nodes, next.edges);
      if (!validation.ok) {
        skip({ kind: "notice", messageKey: validation.messageKey });
        continue;
      }
      next = {
        ...next,
        edges:
          action.kind === "edgeDirection"
            ? patchEdgeData(next.edges, edge.id, {
                direction: action.direction,
              })
            : reverseEdgeById(next.edges, edge.id),
      };
      result.changedCount++;
    }
  }
  return { graph: next, result };
}

export function bulkPropertyAvailability(
  graph: GraphData,
  action: BulkPropertyAction,
) {
  const { result } = applyBulkProperty(graph, action);
  return {
    available: result.targetCount > result.skippedCount,
    reasons: result.reasons,
  };
}
