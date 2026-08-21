import type { GraphCanvasNode, GraphData, GraphEdgeType } from "./type";
import { isGroupNode } from "./type";
import { GROUP_DEFAULT_HEIGHT, GROUP_DEFAULT_WIDTH } from "./utils/groups";
import { compactLabels } from "./utils/labels";

/**
 * 描画用の派生情報
 * （ノードの handles、エッジの自動採番されたsourceHandle / targetHandle 等）
 * を除き、永続化・API 送信に使うグラフデータへ変換
 * ポイントの position はノード中心の座標（POINT_NODE_ORIGIN）、
 * グループの position は左上の座標。
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
          data: {
            label: n.data.label,
            // 手動リサイズの下限はフィット計算の入力なので保存する
            ...(n.data.minWidth !== undefined
              ? { minWidth: n.data.minWidth }
              : {}),
            ...(n.data.minHeight !== undefined
              ? { minHeight: n.data.minHeight }
              : {}),
          },
        };
      }
      return {
        id: n.id,
        type: "graph" as const,
        position,
        ...parent,
        data: {
          labels: compactLabels(n.data.labels),
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
