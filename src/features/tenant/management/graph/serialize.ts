import type { GraphCanvasNode, GraphData, GraphEdgeType } from "./type";
import { isGroupNode } from "./type";
import { GROUP_DEFAULT_HEIGHT, GROUP_DEFAULT_WIDTH } from "./utils/groups";

/**
 * 描画用の派生情報
 * （ノードの handles、エッジの自動採番されたsourceHandle / targetHandle 等）
 * を除き、永続化・API 送信に使うグラフデータへ変換
 */
export function toGraphData(
  nodes: GraphCanvasNode[],
  edges: GraphEdgeType[],
): GraphData {
  return {
    nodes: nodes.map((n) => {
      const position = {
        x: Math.round(n.position.x),
        y: Math.round(n.position.y),
      };
      const parent = n.parentId ? { parentId: n.parentId } : {};
      if (isGroupNode(n)) {
        return {
          id: n.id,
          type: "graphGroup" as const,
          position,
          ...parent,
          width: Math.round(
            n.width ?? n.measured?.width ?? GROUP_DEFAULT_WIDTH,
          ),
          height: Math.round(
            n.height ?? n.measured?.height ?? GROUP_DEFAULT_HEIGHT,
          ),
          data: { label: n.data.label },
        };
      }
      return {
        id: n.id,
        type: "graph" as const,
        position,
        ...parent,
        data: {
          label: n.data.label,
          nodeType: n.data.nodeType,
          ...(n.data.observationPointIds &&
          n.data.observationPointIds.length > 0
            ? { observationPointIds: n.data.observationPointIds }
            : {}),
        },
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "graph",
      data: {
        direction: e.data?.direction ?? "both",
        ...(e.data?.label !== undefined ? { label: e.data.label } : {}),
        ...(e.data?.observationPointIds && e.data.observationPointIds.length > 0
          ? { observationPointIds: e.data.observationPointIds }
          : {}),
      },
    })),
  };
}
