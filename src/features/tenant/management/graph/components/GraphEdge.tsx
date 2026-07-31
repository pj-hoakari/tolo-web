"use client";

import { BaseEdge, type EdgeProps, getBezierPath } from "@xyflow/react";
import type { GraphEdgeType } from "../type";

// GraphCanvas.css
const STROKE = "var(--graph-edge-stroke)";
const STROKE_SELECTED = "var(--graph-edge-stroke-selected)";
/** ルート上を通過する円アイコンの半径 */
const DOT_RADIUS = 3.5;
/** 円アイコンが1区間（始点→終点）を通過する時間(秒) */
const DOT_LEG_DURATION = 2;

export function GraphEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
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

  const direction = data?.direction ?? "both";
  const both = direction === "both";
  const stroke = selected ? STROKE_SELECTED : STROKE;
  const strokeWidth = selected ? 2.5 : 2;
  const marker = selected ? "url(#graph-arrow-selected)" : "url(#graph-arrow)";

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerStart={both ? marker : undefined}
        markerEnd={marker}
        style={{ stroke, strokeWidth }}
      />
      {/* ルート上を定期的に通過する円アイコン
          片側通行は始点→終点へ1つ、
          両通行は逆向きの2つを同周期で流して交差 */}
      <RouteDot path={path} color={stroke} />
      {both ? <RouteDot path={path} color={stroke} reverse /> : null}
    </>
  );
}

/** ルート(path)上を一定周期で通過する円アイコン reverse=終点→始点。 */
function RouteDot({
  path,
  color,
  reverse,
}: {
  path: string;
  color: string;
  reverse?: boolean;
}) {
  return (
    <circle
      r={DOT_RADIUS}
      fill={color}
      stroke="var(--background)"
      strokeWidth={1.5}
      style={{ pointerEvents: "none" }}
    >
      <animateMotion
        dur={`${DOT_LEG_DURATION}s`}
        repeatCount="indefinite"
        path={path}
        calcMode="linear"
        keyPoints={reverse ? "1;0" : "0;1"}
        keyTimes="0;1"
      />
    </circle>
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
