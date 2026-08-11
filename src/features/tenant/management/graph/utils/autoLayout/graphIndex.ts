import type { XYPosition } from "@xyflow/react";
import {
  type GraphCanvasNode,
  type GraphEdgeType,
  isPointNode,
} from "../../type";
import { absolutePositionOf, sizeOf } from "../groups";
import type { ContainerId, GraphIndex, LiftedEdge } from "./types";

/** ノード配列から親子関係の索引を作る */
export function buildIndex(nodes: GraphCanvasNode[]): GraphIndex {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<ContainerId, GraphCanvasNode[]>();
  for (const node of nodes) {
    const key =
      node.parentId !== undefined && byId.has(node.parentId)
        ? node.parentId
        : undefined;
    const list = childrenOf.get(key);
    if (list) list.push(node);
    else childrenOf.set(key, [node]);
  }
  return { byId, childrenOf };
}

/** ノードが直接所属するコンテナ（undefined = キャンバス直下） */
export function parentContainerOf(
  nodeId: string,
  index: GraphIndex,
): ContainerId {
  const parentId = index.byId.get(nodeId)?.parentId;
  return parentId !== undefined && index.byId.has(parentId)
    ? parentId
    : undefined;
}

/**
 * ノードを、指定コンテナの直下メンバーであるノード（自身または祖先）へ
 * 持ち上げる。コンテナの外にあるノードは undefined。
 */
export function representativeIn(
  container: ContainerId,
  nodeId: string,
  index: GraphIndex,
): string | undefined {
  let currentId: string | undefined = nodeId;
  const visited = new Set<string>();
  while (currentId !== undefined && !visited.has(currentId)) {
    visited.add(currentId);
    if (!index.byId.has(currentId)) return undefined;
    const parent = parentContainerOf(currentId, index);
    if (parent === container) return currentId;
    currentId = parent;
  }
  return undefined;
}

/** ルートをコンテナ直下メンバー間の隣接（内側）と外向きの参照（外側）に分ける */
export function liftEdges(
  container: ContainerId,
  edges: GraphEdgeType[],
  index: GraphIndex,
): { internal: LiftedEdge[]; external: Map<string, string[]> } {
  const internal: LiftedEdge[] = [];
  const external = new Map<string, string[]>();
  const pushExternal = (member: string, outsideId: string) => {
    const list = external.get(member);
    if (list) list.push(outsideId);
    else external.set(member, [outsideId]);
  };
  for (const edge of edges) {
    const from = representativeIn(container, edge.source, index);
    const to = representativeIn(container, edge.target, index);
    if (from !== undefined && to !== undefined) {
      if (from !== to) {
        internal.push({
          from,
          to,
          sourceId: edge.source,
          targetId: edge.target,
        });
      }
      continue;
    }
    if (from !== undefined) pushExternal(from, edge.target);
    if (to !== undefined) pushExternal(to, edge.source);
  }
  return { internal, external };
}

/**
 * 全ノードの現在の絶対中心。
 * フロー軸の判定・並び順の初期値・全体位置の保持に使う
 */
export function currentCentersOf(
  nodes: GraphCanvasNode[],
  index: GraphIndex,
): Map<string, XYPosition> {
  const centers = new Map<string, XYPosition>();
  for (const node of nodes) {
    const abs = absolutePositionOf(node, index.byId);
    const size = sizeOf(node);
    centers.set(
      node.id,
      isPointNode(node)
        ? abs
        : { x: abs.x + size.width / 2, y: abs.y + size.height / 2 },
    );
  }
  return centers;
}
