"use client";

import { BaseEdge, type EdgeProps, getBezierPath } from "@xyflow/react";
import type { GraphEdgeType } from "../type";

const STROKE = "#475569";
const STROKE_SELECTED = "#2563eb";

export function GraphEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps<GraphEdgeType>) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const stroke = selected ? STROKE_SELECTED : STROKE;
  const strokeWidth = selected ? 2.5 : 1.6;
  const markerEnd = selected
    ? "url(#graph-arrow-selected)"
    : "url(#graph-arrow)";

  return (
    <BaseEdge
      id={id}
      path={path}
      style={{ stroke, strokeWidth }}
      markerEnd={markerEnd}
    />
  );
}

/** エッジ矢印の marker 定義 */
export function GraphEdgeMarkers() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0 }}
    >
      <title>graph edge markers</title>
      <defs>
        <marker
          id="graph-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={STROKE} />
        </marker>
        <marker
          id="graph-arrow-selected"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={STROKE_SELECTED} />
        </marker>
      </defs>
    </svg>
  );
}
