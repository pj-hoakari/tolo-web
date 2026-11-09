"use client";

// 地図（キャンバス）まわりの小さな部品：定規・全体図・ピン・大きさを変えるつまみと、地図の項目の見た目

import type * as React from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n";
import { type Corner, PAN_PAD } from "./shared";
import {
  type Floor,
  isConnector,
  markBoxOf,
  paletteOf,
  shownColorOf,
  toPointsAttr,
  type VenueMapDoc,
} from "./venueMap";
import { floorBounds } from "./venueMapSvg";

// 定規：キャンバスの上と左に、地図の座標の目盛りを出す（グリッドと同じ数え方。左上が 0）。
// 選んでいるものの範囲は色の帯、マウスの位置は細い線（markXRef / markYRef を親が直接動かす）で示す
const RULER = 22; // 定規の太さ（px）

type RulersProps = {
  zoom: number;
  view: { sl: number; st: number; cw: number; ch: number };
  selBox: { l: number; t: number; r: number; b: number } | null;
  markXRef: React.RefObject<HTMLDivElement | null>;
  markYRef: React.RefObject<HTMLDivElement | null>;
};

export function Rulers({
  zoom,
  view,
  selBox,
  markXRef,
  markYRef,
}: RulersProps) {
  // 目盛りの間隔：大きい目盛りが 70px 以上あくように選ぶ（細かい目盛りはその 1/5）
  const major =
    [10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find((m) => m * zoom >= 70) ??
    5000;
  const minor = major / 5;
  const toX = (v: number) => PAN_PAD + v * zoom - view.sl;
  const toY = (v: number) => PAN_PAD + v * zoom - view.st;
  const ticks = (from: number, to: number) => {
    const out: number[] = [];
    for (let v = Math.floor(from / minor) * minor; v <= to; v += minor)
      out.push(Math.round(v * 1000) / 1000);
    return out;
  };
  const x0 = (view.sl - PAN_PAD) / zoom;
  const y0 = (view.st - PAN_PAD) / zoom;
  const xs = ticks(x0, x0 + view.cw / zoom);
  const ys = ticks(y0, y0 + view.ch / zoom);
  const line = "var(--studio-text-secondary)";
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
    >
      {/* 上の定規 */}
      <svg
        aria-hidden="true"
        className="absolute top-0 left-0 border-b bg-card/95"
        width={view.cw}
        height={RULER}
        style={{ borderColor: "var(--studio-divider)" }}
      >
        {selBox && (
          <rect
            x={toX(selBox.l)}
            y={0}
            width={Math.max(1, (selBox.r - selBox.l) * zoom)}
            height={RULER}
            fill="var(--studio-accent)"
            fillOpacity={0.18}
          />
        )}
        {xs.map((v) => {
          const x = toX(v);
          const isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
          return (
            <g key={v}>
              <line
                x1={x}
                x2={x}
                y1={isMajor ? 6 : RULER - 5}
                y2={RULER}
                stroke={line}
                strokeOpacity={isMajor ? 0.7 : 0.35}
              />
              {isMajor && (
                <text
                  x={x + 3}
                  y={11}
                  fontSize={9.5}
                  fontFamily="var(--font-mono)"
                  fill={line}
                >
                  {v}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {/* 左の定規 */}
      <svg
        aria-hidden="true"
        className="absolute top-0 left-0 border-r bg-card/95"
        width={RULER}
        height={view.ch}
        style={{ borderColor: "var(--studio-divider)" }}
      >
        {selBox && (
          <rect
            x={0}
            y={toY(selBox.t)}
            width={RULER}
            height={Math.max(1, (selBox.b - selBox.t) * zoom)}
            fill="var(--studio-accent)"
            fillOpacity={0.18}
          />
        )}
        {ys.map((v) => {
          const y = toY(v);
          const isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
          return (
            <g key={v}>
              <line
                x1={isMajor ? 6 : RULER - 5}
                x2={RULER}
                y1={y}
                y2={y}
                stroke={line}
                strokeOpacity={isMajor ? 0.7 : 0.35}
              />
              {isMajor && (
                <text
                  x={11}
                  y={y + 3}
                  fontSize={9.5}
                  fontFamily="var(--font-mono)"
                  fill={line}
                  transform={`rotate(-90 11 ${y + 3})`}
                  textAnchor="end"
                >
                  {v}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {/* 左上の角 */}
      <div
        className="absolute top-0 left-0 border-r border-b bg-card"
        style={{
          width: RULER,
          height: RULER,
          borderColor: "var(--studio-divider)",
        }}
      />
      {/* マウスの位置の目印 */}
      <div
        ref={markXRef}
        className="absolute top-0 left-0 w-px opacity-0"
        style={{ height: RULER, background: "var(--studio-accent)" }}
      />
      <div
        ref={markYRef}
        className="absolute top-0 left-0 h-px opacity-0"
        style={{ width: RULER, background: "var(--studio-accent)" }}
      />
    </div>
  );
}

// 全体図（ミニマップ）：その階の中身を小さく描き、いま見えている範囲を枠で示す。押す・ドラッグでその場所へ移動
type MiniMapProps = {
  doc: VenueMapDoc;
  floor: Floor;
  zoom: number;
  view: { sl: number; st: number; cw: number; ch: number };
  onJump: (x: number, y: number) => void;
};

export function MiniMap({ doc, floor, zoom, view, onJump }: MiniMapProps) {
  const { t } = useI18n();
  const W = 168;
  const H = 104;
  const content = floorBounds(doc, floor, 40);
  // いま見えている範囲（地図の座標）
  const vp = {
    x: (view.sl - PAN_PAD) / zoom,
    y: (view.st - PAN_PAD) / zoom,
    w: view.cw / zoom,
    h: view.ch / zoom,
  };
  // 中身と見えている範囲の両方が入るように
  const l = Math.min(content.x, vp.x);
  const tp = Math.min(content.y, vp.y);
  const r = Math.max(content.x + content.w, vp.x + vp.w);
  const b = Math.max(content.y + content.h, vp.y + vp.h);
  const k = Math.min(W / Math.max(1, r - l), H / Math.max(1, b - tp));
  const ox = (W - (r - l) * k) / 2;
  const oy = (H - (b - tp) * k) / 2;
  const toMap = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: l + (e.clientX - rect.left - ox) / k,
      y: tp + (e.clientY - rect.top - oy) / k,
    };
  };
  const objs = doc.objects.filter((o) => o.floor === floor.id);
  // 地図の中身がぜんぶ見えているときは、全体図は要らないので出さない
  if (
    content.x >= vp.x &&
    content.y >= vp.y &&
    content.x + content.w <= vp.x + vp.w &&
    content.y + content.h <= vp.y + vp.h
  )
    return null;
  return (
    <div
      data-keep-selection
      className="absolute right-3 bottom-3 z-30 overflow-hidden rounded-md border bg-card/95"
      title={t("全体図（押すとその場所へ移動）")}
    >
      <svg
        width={W}
        height={H}
        role="img"
        aria-label={t("全体図")}
        className="block cursor-pointer touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const p = toMap(e);
          onJump(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const p = toMap(e);
          onJump(p.x, p.y);
        }}
      >
        <g
          transform={`translate(${ox} ${oy}) scale(${k}) translate(${-l} ${-tp})`}
        >
          {objs.map((o) => {
            const fill = paletteOf(shownColorOf(o)).fill;
            if (o.kind === "area")
              return (
                <polygon
                  key={o.id}
                  points={toPointsAttr(o.points)}
                  fill={fill}
                  fillOpacity={0.08}
                  stroke={fill}
                  strokeOpacity={0.5}
                  strokeWidth={1 / k}
                />
              );
            if (o.kind === "route" || o.kind === "text") return null;
            if (o.shape === "pin" && !isConnector(o))
              return (
                <circle key={o.id} cx={o.x} cy={o.y} r={3 / k} fill={fill} />
              );
            const box = o.shape === "pin" ? markBoxOf(o) : { w: o.w, h: o.h };
            return (
              <rect
                key={o.id}
                x={o.x - box.w / 2}
                y={o.y - box.h / 2}
                width={box.w}
                height={box.h}
                fill={fill}
                fillOpacity={0.35}
                stroke={fill}
                strokeWidth={1 / k}
              />
            );
          })}
          <rect
            x={vp.x}
            y={vp.y}
            width={vp.w}
            height={vp.h}
            fill="var(--studio-accent)"
            fillOpacity={0.08}
            stroke="var(--studio-accent)"
            strokeWidth={1.5 / k}
          />
        </g>
      </svg>
    </div>
  );
}

// --- 地図の項目の見た目（案A「上質な図面」）---
// 面：選んだ色をごく薄く（8%）だけ面の色に重ねる／線：選んだ色を少し落ち着かせる（ライト・ダークどちらでも馴染む）
// 部屋の面：部屋の色を少しだけ、明るい紙（--studio-room）に混ぜる。地図の面より明るくして浮かせる
export const objFill = (color: string) =>
  `color-mix(in srgb, ${color} 7%, var(--studio-room))`;

export const objLine = (color: string) =>
  `color-mix(in srgb, ${color} 70%, var(--studio-divider))`;

// 表示だけ全角の英数字を半角にする（データはそのまま）
const toHalfWidth = (s: string) =>
  s.replace(/[０-９Ａ-Ｚａ-ｚ－]/g, (c) =>
    c === "－" ? "-" : String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

// 「302 教室」→ 番号 302 と名前「教室」。「402」だけなら番号のみ
export function splitTitle(title?: string): { num: string; name: string } {
  const t = (title ?? "").trim();
  const m = t.match(/^([0-9０-９A-Za-zＡ-Ｚａ-ｚ\-－]+)(?:\s+(.+))?$/);
  if (m) return { num: toHalfWidth(m[1]), name: m[2] ?? "" };
  return { num: "", name: t };
}

// 小さな点＋細い輪のピン。プレビューでタップしたときだけ輪が少し広がる
export function PinDot({
  color,
  line,
  sel,
  tapped,
  inline,
}: {
  color: string;
  line: string;
  sel: boolean;
  tapped: boolean;
  inline?: boolean;
}) {
  return (
    <span
      className={cn(
        "pointer-events-none flex size-[18px] shrink-0 items-center justify-center",
        inline ? "relative" : "absolute -translate-x-1/2 -translate-y-1/2",
      )}
    >
      <span
        className={cn(
          "absolute inset-0 rounded-full border",
          tapped && "studio-pin-ping",
        )}
        style={{
          borderColor: sel ? "var(--studio-accent)" : line,
          borderWidth: sel ? 1.5 : 1,
          background: "var(--studio-surface)",
        }}
      />
      <span
        className="relative size-[7px] rounded-full"
        style={{ background: color }}
      />
    </span>
  );
}

type ResizeHandlesProps = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  zoom: number;
  onStart: (e: React.PointerEvent, id: string, corner: Corner) => void;
};

export function ResizeHandles({
  id,
  x,
  y,
  w,
  h,
  zoom,
  onStart,
}: ResizeHandlesProps) {
  return (
    <>
      {(["nw", "ne", "sw", "se"] as Corner[]).map((c) => {
        const left =
          (c === "nw" || c === "sw" ? x - w / 2 : x + w / 2) - 7 / zoom;
        const top =
          (c === "nw" || c === "ne" ? y - h / 2 : y + h / 2) - 7 / zoom;
        return (
          <div
            key={c}
            onPointerDown={(ev) => onStart(ev, id, c)}
            className="absolute z-30 rounded-sm border-2 border-primary bg-card"
            style={{
              left,
              top,
              width: 14 / zoom,
              height: 14 / zoom,
              cursor: c === "nw" || c === "se" ? "nwse-resize" : "nesw-resize",
            }}
          />
        );
      })}
    </>
  );
}
