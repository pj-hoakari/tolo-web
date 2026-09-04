"use client";

import { Toggle, ToggleButtonGroup } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import type { GuideGraph, GuidePoint } from "./graphGuideModel";
import { routeSegmentKeys } from "./graphGuideRoute";

export type GraphGuideViewProps = {
  /** 会場グラフの変換結果 */
  model: GuideGraph;
  /** 選択中の目的地（地点）ID。未選択は null */
  selectedGoalId: string | null;
  onSelectGoal: (goalId: string) => void;
  /** 現在地→目的地の経路（ノード ID の順序）。未選択なら空 */
  routeIds: string[];
  hint: string;
  currentLocationLabel: string;
  destinationsLabel: string;
};

/** 線分の両端をノード半径ぶん縮め、マーカー（円・矢印）と重ならないようにする */
function trimSegment(
  from: GuidePoint,
  to: GuidePoint,
  trimFrom: number,
  trimTo: number,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  return {
    x1: from.x + ux * trimFrom,
    y1: from.y + uy * trimFrom,
    x2: to.x - ux * trimTo,
    y2: to.y - uy * trimTo,
  };
}

export function GraphGuideView({
  model,
  selectedGoalId,
  onSelectGoal,
  routeIds,
  hint,
  currentLocationLabel,
  destinationsLabel,
}: GraphGuideViewProps) {
  const { width, height, floors, points, edges, goals, start } = model;

  const pointById = new Map(points.map((p) => [p.id, p]));
  const routeKeys = routeSegmentKeys(routeIds);
  const onRoute = new Set(routeIds);

  // 見た目のサイズは viewBox の高さに比例させ、拡大縮小しても一定に見せる
  const labelSize = Math.round(height * 0.024);
  const floorLabelSize = Math.round(height * 0.03);
  const goalRadius = Math.round(height * 0.013);
  const transitRadius = Math.round(height * 0.008);
  const startRadius = Math.round(height * 0.015);
  const radiusOf = (point: GuidePoint) =>
    point.type === "TRANSIT_ONLY" ? transitRadius : goalRadius;

  return (
    <div>
      {goals.length > 0 && (
        <ToggleButtonGroup
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={selectedGoalId ? [selectedGoalId] : []}
          onSelectionChange={(keys) => {
            const next = [...keys][0];
            if (next != null) onSelectGoal(String(next));
          }}
          aria-label={destinationsLabel}
          className="mb-4 flex-wrap justify-start gap-2"
        >
          {goals.map((goal) => (
            <Toggle
              key={goal.id}
              id={goal.id}
              size="sm"
              className="h-auto rounded-full border border-primary/12 selected:border-accent bg-secondary selected:bg-accent px-3 py-1 selected:font-medium selected:text-secondary text-primary/55 text-sm hover:bg-secondary hover:text-accent"
            >
              {goal.label}
            </Toggle>
          ))}
        </ToggleButtonGroup>
      )}

      <div className="rounded-xl border border-primary/15 bg-primary/12">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-label={destinationsLabel}
        >
          <defs>
            {/* 片方向エッジの矢印（通常・経路強調の 2 色） */}
            <marker
              id="gg-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" className="fill-primary/30" />
            </marker>
            <marker
              id="gg-arrow-accent"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" className="fill-accent" />
            </marker>
          </defs>

          {/* フロア（グループ）の枠 */}
          {floors.map((floor) => (
            <g key={floor.id}>
              <rect
                x={floor.x}
                y={floor.y}
                width={floor.width}
                height={floor.height}
                rx={12}
                className="fill-primary/[0.03] stroke-primary/15"
                strokeWidth={1.5}
              />
              <text
                x={floor.x + 12}
                y={floor.y + floorLabelSize + 6}
                fontSize={floorLabelSize}
                className="fill-primary/40 font-medium"
              >
                {floor.label}
              </text>
            </g>
          ))}

          {/* 通路（エッジ） */}
          {edges.map((edge) => {
            const from = pointById.get(edge.from);
            const to = pointById.get(edge.to);
            if (!from || !to) return null;
            const isRouteEdge = routeKeys.has(`${edge.from}\t${edge.to}`);
            const seg = trimSegment(
              from,
              to,
              radiusOf(from) + 2,
              radiusOf(to) + 2,
            );
            const oneway = edge.direction === "oneway";
            const marker = oneway
              ? isRouteEdge
                ? "url(#gg-arrow-accent)"
                : "url(#gg-arrow)"
              : undefined;
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            return (
              <g key={edge.id}>
                <line
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  strokeLinecap="round"
                  strokeWidth={isRouteEdge ? 4 : 2}
                  className={
                    isRouteEdge ? "stroke-accent" : "stroke-primary/20"
                  }
                  markerEnd={marker}
                />
                {edge.label && (
                  <text
                    x={midX}
                    y={midY - 4}
                    textAnchor="middle"
                    fontSize={labelSize}
                    className="fill-primary/55"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* 地点（ノード） */}
          {points.map((point) => {
            const isStart = point.id === start;
            const isSelected = point.id === selectedGoalId;
            const emphasized = isSelected || onRoute.has(point.id);
            const radius = radiusOf(point);
            return (
              <g key={point.id}>
                {isSelected && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={radius + 5}
                    fill="none"
                    strokeWidth={2.5}
                    className="animate-pulse stroke-accent"
                  />
                )}
                {isStart ? (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={startRadius}
                    strokeWidth={2}
                    className="fill-primary stroke-secondary"
                  />
                ) : (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={radius}
                    strokeWidth={emphasized ? 2.5 : 1.5}
                    className={cn(
                      point.type === "TRANSIT_ONLY"
                        ? "fill-primary/35"
                        : "fill-secondary",
                      // isSelected は emphasized に含まれるのでまとめて判定する
                      emphasized ? "stroke-accent" : "stroke-primary/30",
                    )}
                  />
                )}
                <text
                  x={point.x}
                  y={point.y - radius - 4}
                  textAnchor="middle"
                  fontSize={labelSize}
                  className={cn(
                    isStart ? "fill-primary font-medium" : "fill-primary/70",
                  )}
                >
                  {isStart ? currentLocationLabel : point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {selectedGoalId === null && (
        <p className="mt-3 text-primary/55 text-sm">{hint}</p>
      )}
    </div>
  );
}
