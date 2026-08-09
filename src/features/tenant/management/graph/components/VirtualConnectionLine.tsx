"use client";

import {
  type Connection,
  type ConnectionLineComponentProps,
  getBezierPath,
} from "@xyflow/react";
import type { GraphCanvasNode, GraphEdgeType, HandleSide } from "../type";
import {
  findConnectionPreview,
  toFlowPosition,
} from "../utils/connectionPreview";
import { connectHandleId } from "../utils/handles";
import { positionBySide } from "./nodeHandles";

/** 接続ドラッグ中に表示する開始側の仮想端点 */
export type VirtualHandle = { nodeId: string; side: HandleSide };

/**
 * 接続ドラッグ中の接続線。
 * - ポインタがノードに近づいたら、確定後と同じ両端位置へスナップした
 *   破線プレビューを表示する
 * - 開始ノードには仮想端点を使い、エッジが1本増えた場合と同じ位置から引く
 */
export function VirtualConnectionLine({
  virtualHandle,
  nodes,
  viewport,
  isValidConnection,
  fromHandle,
  fromNode,
  fromPosition,
  fromX,
  fromY,
  pointer,
  toPosition,
  toX,
  toY,
  connectionLineStyle,
}: ConnectionLineComponentProps<GraphCanvasNode> & {
  virtualHandle: VirtualHandle | null;
  nodes: GraphCanvasNode[];
  viewport: { x: number; y: number; zoom: number };
  isValidConnection: (connection: Connection | GraphEdgeType) => boolean;
}) {
  const preview = findConnectionPreview(
    toFlowPosition(pointer, viewport),
    nodes,
    fromNode.id,
  );
  const connection = preview
    ? {
        source: preview.sourceId,
        sourceHandle: null,
        target: preview.targetId,
        targetHandle: null,
      }
    : null;
  const virtualPreview =
    preview && connection && isValidConnection(connection) ? preview : null;
  // 接続の始点になるのはポイントのみ（グループは handles を持たない）
  const fromHandles =
    "handles" in fromNode.data ? fromNode.data.handles : undefined;
  const virtualSlot = virtualHandle
    ? fromHandles?.[virtualHandle.side].find((slot) => slot.virtual)
    : undefined;
  const shouldUseVirtualSlot =
    virtualHandle !== null &&
    fromNode.id === virtualHandle.nodeId &&
    fromHandle.id === connectHandleId(virtualHandle.side) &&
    virtualSlot !== undefined;
  const source = virtualPreview
    ? virtualPreview.sourcePosition
    : shouldUseVirtualSlot
      ? virtualSlotPosition(fromNode, virtualSlot)
      : { x: fromX, y: fromY };
  const target = virtualPreview?.targetPosition ?? { x: toX, y: toY };
  const [path] = getBezierPath({
    sourceX: source.x,
    sourceY: source.y,
    sourcePosition: virtualPreview
      ? positionBySide[virtualPreview.sourceSide]
      : fromPosition,
    targetX: target.x,
    targetY: target.y,
    targetPosition: virtualPreview
      ? positionBySide[virtualPreview.targetSide]
      : toPosition,
  });

  return (
    <path
      d={path}
      fill="none"
      className="react-flow__connection-path"
      style={
        virtualPreview
          ? { ...connectionLineStyle, strokeDasharray: "6 4" }
          : connectionLineStyle
      }
    />
  );
}

function virtualSlotPosition(
  node: ConnectionLineComponentProps<GraphCanvasNode>["fromNode"],
  slot: { side: HandleSide; index: number; total: number },
) {
  const width = node.measured.width ?? node.width ?? 0;
  const height = node.measured.height ?? node.height ?? 0;
  const position = (slot.index + 1) / (slot.total + 1);
  const { x, y } = node.internals.positionAbsolute;

  switch (slot.side) {
    case "top":
      return { x: x + width * position, y };
    case "right":
      return { x: x + width, y: y + height * position };
    case "bottom":
      return { x: x + width * position, y: y + height };
    case "left":
      return { x, y: y + height * position };
  }
}
