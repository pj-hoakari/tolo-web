import type { EdgeChange, NodeChange } from "@xyflow/react";
import type {
  EdgeDirection,
  GraphCanvasNode,
  GraphEdgeData,
  GraphEdgeType,
  GraphNodeData,
  GraphNodeType,
  GroupNodeType,
  NodeType,
} from "../type";
import { isPointNode } from "../type";
import { GROUP_DEFAULT_HEIGHT, GROUP_DEFAULT_WIDTH } from "./groups";

/** data を持たないエッジに補う既定の通行方向 */
const DEFAULT_DIRECTION: EdgeDirection = "both";

/** 変更セットのうち削除されたものの ID を集める */
export function removedIds(
  changes: (NodeChange<GraphCanvasNode> | EdgeChange<GraphEdgeType>)[],
): string[] {
  return changes.flatMap((change) =>
    change.type === "remove" ? [change.id] : [],
  );
}

export function createNode(params: {
  id: string;
  label: string;
  nodeType: NodeType;
  position: { x: number; y: number };
}): GraphNodeType {
  return {
    id: params.id,
    type: "graph",
    position: params.position,
    data: { label: params.label, nodeType: params.nodeType },
  };
}

export function createGroup(params: {
  id: string;
  label: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
}): GroupNodeType {
  return {
    id: params.id,
    type: "graphGroup",
    position: params.position,
    width: params.width ?? GROUP_DEFAULT_WIDTH,
    height: params.height ?? GROUP_DEFAULT_HEIGHT,
    data: { label: params.label },
  };
}

export function createEdge(params: {
  id: string;
  source: string;
  target: string;
  direction: EdgeDirection;
}): GraphEdgeType {
  return {
    id: params.id,
    source: params.source,
    target: params.target,
    // 接続辺(sourceHandle/targetHandle)は位置から自動決定
    // 描画時に assignHandlesByPosition が付与する
    type: "graph",
    data: { direction: params.direction },
  };
}

/**
 * 指定ノードの data を部分更新した新しい配列を返す。
 * グループコンテナにはポイント固有のフィールドがないため、ラベルのみ反映する。
 */
export function patchNodeData(
  nodes: GraphCanvasNode[],
  id: string,
  patch: Partial<GraphNodeData>,
): GraphCanvasNode[] {
  return nodes.map((n) => {
    if (n.id !== id) return n;
    if (isPointNode(n)) return { ...n, data: { ...n.data, ...patch } };
    return patch.label !== undefined
      ? { ...n, data: { ...n.data, label: patch.label } }
      : n;
  });
}

/** 指定エッジの data を部分更新した新しい配列を返す */
export function patchEdgeData(
  edges: GraphEdgeType[],
  id: string,
  patch: Partial<GraphEdgeData>,
): GraphEdgeType[] {
  return edges.map((e) =>
    e.id === id
      ? {
          ...e,
          data: { ...(e.data ?? { direction: DEFAULT_DIRECTION }), ...patch },
        }
      : e,
  );
}

/** 指定エッジの始点と終点を入れ替えた新しい配列を返す */
export function reverseEdgeById(
  edges: GraphEdgeType[],
  id: string,
): GraphEdgeType[] {
  return edges.map((e) =>
    e.id === id ? { ...e, source: e.target, target: e.source } : e,
  );
}

export function withoutNode(
  nodes: GraphCanvasNode[],
  id: string,
): GraphCanvasNode[] {
  return nodes.filter((n) => n.id !== id);
}

/** 指定ノードに接続しているエッジをすべて除いた新しい配列を返す */
export function withoutEdgesOf(
  edges: GraphEdgeType[],
  nodeId: string,
): GraphEdgeType[] {
  return edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
}

export function withoutEdge(
  edges: GraphEdgeType[],
  id: string,
): GraphEdgeType[] {
  return edges.filter((e) => e.id !== id);
}
