import type { GraphData, GraphEdgeType, GraphNodeType } from "./type";

/**
 * 描画用の派生情報
 * （ノードの handles、エッジの自動採番されたsourceHandle / targetHandle 等）
 * を除き、永続化・API 送信に使うグラフデータへ変換
 */
export function toGraphData(
  nodes: GraphNodeType[],
  edges: GraphEdgeType[],
): GraphData {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: "graph",
      position: {
        x: Math.round(n.position.x),
        y: Math.round(n.position.y),
      },
      data: { label: n.data.label, nodeType: n.data.nodeType },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "graph",
      data: {
        direction: e.data?.direction ?? "both",
        ...(e.data?.label !== undefined ? { label: e.data.label } : {}),
      },
    })),
  };
}
