"use client";

import { type KeyboardEvent as ReactKeyboardEvent, useState } from "react";
import { cn } from "@/lib/utils";
import type { NavEdge, NavNode } from "./graphicalInfoNav";
import { InfoCard } from "./InfoCard";

/** フロア（階）の枠。座標はマップ全体の絶対座標（左上原点） */
export type VenueFloorRect = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type VenueMapViewProps = {
  title: string;
  /** SVG viewBox のサイズ（マップ全体） */
  width: number;
  height: number;
  floors: VenueFloorRect[];
  /** 地点（座標は矩形中心・絶対座標） */
  nodes: NavNode[];
  /** 通路（source/target は nodes の id） */
  edges: NavEdge[];
  /** 現在地の地点 ID（この地点を中央に拡大表示し、脈動アニメで示す） */
  currentId: string | null;
  currentLabel: string;
  /** 全体表示へ切り替える操作の aria-label */
  overviewLabel: string;
  /** 現在地表示へ戻す操作の aria-label */
  focusLabel: string;
};

/** 矩形中心どうしを結ぶ線分の両端を、ノード半径ぶん縮める */
function trim(
  from: { x: number; y: number },
  to: { x: number; y: number },
  rFrom: number,
  rTo: number,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: from.x + ux * rFrom,
    y1: from.y + uy * rFrom,
    x2: to.x - ux * rTo,
    y2: to.y - uy * rTo,
  };
}

/** 地点の見た目半径（矩形は内接円相当） */
const radiusOf = (n: { w: number; h: number }) => Math.min(n.w, n.h) / 2;

export function VenueMapView({
  title,
  width,
  height,
  floors,
  nodes,
  edges,
  currentId,
  currentLabel,
  overviewLabel,
  focusLabel,
}: VenueMapViewProps) {
  // 既定は現在地を中央に拡大表示。タップ（クリック）で全体表示へ切り替える。
  const [overview, setOverview] = useState(false);

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const current = currentId ? nodeById.get(currentId) : undefined;

  // 現在地にフォーカスするときの表示窓（viewBox）。現在地を中央に置く。
  const focusW = Math.min(width, Math.max(380, width * 0.5));
  const focusH = focusW * 0.72;
  const focused = !overview && current;
  const viewBox = focused
    ? `${current.x - focusW / 2} ${current.y - focusH / 2} ${focusW} ${focusH}`
    : `0 0 ${width} ${height}`;
  const vbH = focused ? focusH : height;

  // ラベル等のサイズ。部屋・通路はマップ全体基準（ズームで自然に拡縮）、
  // 現在地マーカーは表示窓基準にして、どのズームでも一定の大きさに見せる。
  const labelSize = Math.round(height * 0.02);
  const floorLabelSize = Math.round(height * 0.028);
  const markerR = Math.round(vbH * 0.028);
  const markerLabel = Math.round(vbH * 0.03);

  function toggle() {
    setOverview((v) => !v);
  }
  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  }

  return (
    <InfoCard title={title}>
      {/* 地図をタップ／クリックで「現在地の拡大」⇔「全体表示」を切り替える */}
      {/* biome-ignore lint/a11y/useSemanticElements: ズーム可能なマップ面。素の button では地図描画を内包できないため role で代替 */}
      <div
        role="button"
        tabIndex={0}
        aria-label={overview ? focusLabel : overviewLabel}
        aria-pressed={overview}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={cn(
          "overflow-hidden rounded-2xl border border-primary/12 bg-gradient-to-br from-primary/5 to-primary/15 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-accent",
          overview ? "cursor-zoom-in" : "cursor-zoom-out",
        )}
      >
        <svg
          viewBox={viewBox}
          className="h-auto w-full"
          role="img"
          aria-label={title}
        >
          <defs>
            <marker
              id="venue-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" className="fill-primary/30" />
            </marker>
          </defs>

          {/* フロア枠 */}
          {floors.map((f) => (
            <g key={f.id}>
              <rect
                x={f.x}
                y={f.y}
                width={f.w}
                height={f.h}
                rx={18}
                className="fill-primary/[0.04] stroke-primary/12"
                strokeWidth={1.5}
              />
              {/* 階名の小さなバッジ */}
              <rect
                x={f.x + 12}
                y={f.y + 12}
                width={floorLabelSize * 2.6}
                height={floorLabelSize * 1.5}
                rx={floorLabelSize * 0.6}
                className="fill-secondary/80 stroke-primary/10"
                strokeWidth={1}
              />
              <text
                x={f.x + 12 + floorLabelSize * 1.3}
                y={f.y + 12 + floorLabelSize}
                textAnchor="middle"
                fontSize={floorLabelSize}
                className="fill-primary/55 font-semibold tracking-wide"
              >
                {f.name}
              </text>
            </g>
          ))}

          {/* 通路（corridors） */}
          {edges.map((e) => {
            const a = nodeById.get(e.source);
            const b = nodeById.get(e.target);
            if (!a || !b) return null;
            const seg = trim(a, b, radiusOf(a) + 2, radiusOf(b) + 2);
            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2;
            return (
              <g key={e.id}>
                <line
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  strokeLinecap="round"
                  strokeWidth={2}
                  className="stroke-primary/20"
                  markerEnd={
                    e.direction === "oneway" ? "url(#venue-arrow)" : undefined
                  }
                />
                {e.label && (
                  <text
                    x={midX}
                    y={midY - 4}
                    textAnchor="middle"
                    fontSize={labelSize}
                    className="fill-primary/55"
                  >
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* 地点（部屋）。種別で淡く色分け（目的地はアクセント寄り） */}
          {nodes.map((n) => {
            const r = radiusOf(n);
            const roomClass =
              n.type === "GOAL" || n.type === "GOAL_TRANSIT_MIXED"
                ? "fill-accent/10 stroke-accent/35"
                : n.type === "BOUNDARY"
                  ? "fill-primary/10 stroke-primary/25"
                  : "fill-secondary stroke-primary/20";
            return (
              <g key={n.id}>
                {n.shape === "circle" ? (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={r}
                    strokeWidth={1.5}
                    className={roomClass}
                  />
                ) : (
                  <rect
                    x={n.x - n.w / 2}
                    y={n.y - n.h / 2}
                    width={n.w}
                    height={n.h}
                    rx={10}
                    strokeWidth={1.5}
                    className={roomClass}
                  />
                )}
                <text
                  x={n.x}
                  y={n.y + labelSize / 3}
                  textAnchor="middle"
                  fontSize={labelSize}
                  className="fill-primary/75"
                >
                  {n.label}
                </text>
              </g>
            );
          })}

          {/* 現在地マーカー（人型・脈動アニメーション付き・中央に配置） */}
          {current &&
            (() => {
              // 24x24 の人型アイコンを、直径 ≒ markerR*2 になるよう配置する
              const iconScale = (markerR * 2) / 24;
              const iconX = current.x - 12 * iconScale;
              const iconY = current.y - 12 * iconScale;
              return (
                <g>
                  {/* 脈動リング */}
                  <circle
                    cx={current.x}
                    cy={current.y}
                    r={markerR * 1.8}
                    className="animate-ping fill-accent/40"
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "center",
                    }}
                  />
                  {/* 白いハロー（人型の視認性確保） */}
                  <circle
                    cx={current.x}
                    cy={current.y}
                    r={markerR * 1.2}
                    strokeWidth={markerR * 0.18}
                    className="fill-secondary stroke-accent"
                  />
                  {/* 人型アイコン */}
                  <g
                    transform={`translate(${iconX} ${iconY}) scale(${iconScale})`}
                  >
                    <path
                      d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                      className="fill-accent"
                    />
                  </g>
                  <text
                    x={current.x}
                    y={current.y - markerR * 1.4 - 4}
                    textAnchor="middle"
                    fontSize={markerLabel}
                    className="fill-accent font-semibold"
                  >
                    {currentLabel}
                  </text>
                </g>
              );
            })()}
        </svg>
      </div>
    </InfoCard>
  );
}
