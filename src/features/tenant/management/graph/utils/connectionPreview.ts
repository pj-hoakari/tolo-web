import type { Viewport, XYPosition } from "@xyflow/react";
import type { GraphCanvasNode, GraphNodeType, HandleSide } from "../type";
import { isPointNode } from "../type";
import { withAbsolutePositions } from "./groups";
import { getConnectionSides } from "./handles";

/** React Flow の既定接続半径（20px）の約2倍。 */
export const CONNECTION_PREVIEW_RADIUS = 40;

/** 仮想エッジとして接続できるノードと、確定後と同じ接続辺。 */
export type ConnectionPreview = {
  sourceId: string;
  targetId: string;
  sourceSide: HandleSide;
  targetSide: HandleSide;
  sourcePosition: XYPosition;
  targetPosition: XYPosition;
};

/** キャンバス座標を React Flow のグラフ座標に変換する。 */
export function toFlowPosition(
  point: XYPosition,
  viewport: Viewport,
): XYPosition {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  };
}

/**
 * ポインタに最も近い接続候補を返す。ノードの内部も距離0として扱うため、
 * ノード上を通過しても仮想エッジは維持される。
 */
export function findConnectionPreview(
  point: XYPosition,
  nodes: GraphCanvasNode[],
  sourceId: string,
  radius = CONNECTION_PREVIEW_RADIUS,
): ConnectionPreview | null {
  // グループはルートの端点にならないので候補から外し、
  // グループ内ノードの親相対 position は絶対座標へ直して距離を測る
  const pointNodes = withAbsolutePositions(nodes).filter(isPointNode);
  const source = pointNodes.find((node) => node.id === sourceId);
  if (!source) return null;

  let target: GraphNodeType | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const node of pointNodes) {
    if (node.id === sourceId) continue;

    const distance = distanceToNode(point, node);
    if (distance <= radius && distance < closestDistance) {
      target = node;
      closestDistance = distance;
    }
  }
  if (!target) return null;

  const { sourceSide, targetSide } = getConnectionSides(source, target);
  return {
    sourceId,
    targetId: target.id,
    sourceSide,
    targetSide,
    sourcePosition: nodeSidePosition(source, sourceSide),
    targetPosition: nodeSidePosition(target, targetSide),
  };
}

/** 指定したノード辺の中央座標。 */
export function nodeSidePosition(
  node: GraphNodeType,
  side: HandleSide,
): XYPosition {
  const { x, y, width, height } = nodeBounds(node);
  switch (side) {
    case "top":
      return { x: x + width / 2, y };
    case "right":
      return { x: x + width, y: y + height / 2 };
    case "bottom":
      return { x: x + width / 2, y: y + height };
    case "left":
      return { x, y: y + height / 2 };
  }
}

function distanceToNode(point: XYPosition, node: GraphNodeType): number {
  const { x, y, width, height } = nodeBounds(node);
  const horizontal = Math.max(x - point.x, 0, point.x - (x + width));
  const vertical = Math.max(y - point.y, 0, point.y - (y + height));
  return Math.hypot(horizontal, vertical);
}

function nodeBounds(node: GraphNodeType) {
  return {
    x: node.position.x,
    y: node.position.y,
    width: node.measured?.width ?? node.width ?? 160,
    height: node.measured?.height ?? node.height ?? 56,
  };
}
