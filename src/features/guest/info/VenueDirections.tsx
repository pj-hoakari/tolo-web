"use client";

import { Compass, MapPin, Navigation } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CompassGuide } from "./CompassGuide";
import { findPath, type NavModel, routePoints } from "./graphicalInfoNav";
import { InfoCard } from "./InfoCard";
import { useHeading } from "./useHeading";

export type VenueDirectionsProps = {
  model: NavModel;
  /** 現在地の地点 ID */
  currentId: string | null;
};

/** 正面（真上）とみなす許容角度。これ以内なら「この方向にある」とみなす */
const AHEAD_TOLERANCE = 32;

/** a→b の方位角（0=北・時計回り）。north はマップ上向きが指す方位角。 */
function bearingOf(
  a: { x: number; y: number },
  b: { x: number; y: number },
  north: number,
) {
  const fromUp = (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI;
  return (((fromUp + north) % 360) + 360) % 360;
}

/** -180〜180 に正規化 */
function normalize(deg: number) {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

/** 真上(=0°)を基準に、時計回り角 θ の円周座標 */
function onRing(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

/**
 * 方位センサーで「スマホが向いている方向」を上として、
 * その正面に何の目的地があるかを示すコンパス型の案内。
 * スマホを回すと、正面に来た目的地が「この方向に〇〇があります」と出る。
 */
export function VenueDirections({ model, currentId }: VenueDirectionsProps) {
  const t = useTranslations("Guest.guideMap");
  const { heading, state, start } = useHeading();
  // 「ここに向かう」で選んだ目的地（コンパス案内を開く）
  const [navGoalId, setNavGoalId] = useState<string | null>(null);

  const nodeById = new Map(model.nodes.map((n) => [n.id, n]));
  const floorName = (id: string) =>
    model.floors.find((f) => f.id === id)?.name ?? "";
  const current = currentId ? nodeById.get(currentId) : undefined;

  const live = state === "on" && heading != null;

  // 各目的地の方角・フロア・経由（階段/エレベーター）を求める
  const targets = model.goals.flatMap((goal) => {
    if (!current || goal.id === current.id) return [];
    const path = findPath(model.edges, current.id, goal.id);
    if (path.length < 2) return [];
    let via: string | undefined;
    for (let i = 0; i < path.length - 1; i++) {
      const a = nodeById.get(path[i]);
      const b = nodeById.get(path[i + 1]);
      if (a && b && a.floor !== b.floor) {
        const edge = model.edges.find(
          (e) =>
            (e.source === a.id && e.target === b.id) ||
            (e.source === b.id && e.target === a.id),
        );
        via = edge?.label;
        break;
      }
    }
    const bearing = bearingOf(current, goal, model.north);
    return [
      {
        id: goal.id,
        label: goal.label,
        bearing,
        floor: floorName(goal.floor),
        sameFloor: goal.floor === current.floor,
        via,
      },
    ];
  });

  // スマホの向きを「上」として、各目的地の相対角を出す（ライブ時のみ）
  const withRel = targets.map((d) => ({
    ...d,
    rel: live ? normalize(d.bearing - (heading as number)) : d.bearing,
  }));

  // 正面に最も近い目的地（ライブ時のみ「正面」を判定）
  const ahead =
    live && withRel.length > 0
      ? withRel.reduce((a, b) => (Math.abs(a.rel) <= Math.abs(b.rel) ? a : b))
      : null;
  const aheadActive = ahead != null && Math.abs(ahead.rel) <= AHEAD_TOLERANCE;

  const CX = 110;
  const CY = 110;
  const R = 84;

  // 「ここに向かう」で選んだ目的地へのコンパス案内用データ
  const navGoal = navGoalId ? nodeById.get(navGoalId) : undefined;
  const navRoute =
    current && navGoalId ? routePoints(model, current.id, navGoalId) : [];
  const navMapNodes = current
    ? model.nodes
        .filter((n) => n.floor === current.floor)
        .map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h }))
    : [];

  return (
    <InfoCard title={t("title")}>
      <p className="mb-3 flex items-center gap-1.5 text-primary/60 text-sm">
        <MapPin className="size-4 text-accent" />
        {t("currentLocation")}
        <span className="font-medium text-primary/90">{current?.label}</span>
      </p>

      {state !== "on" && (
        <div className="mb-3 space-y-2 rounded-lg border border-primary/12 p-3 text-sm">
          <p className="text-primary/60">{t("faceHint")}</p>
          {(state === "idle" || state === "denied") && (
            <Button type="button" size="sm" className="w-full" onPress={start}>
              <Compass className="mr-1.5 size-4" />
              {state === "denied"
                ? t("compass.retrySensor")
                : t("compass.enable")}
            </Button>
          )}
          {state === "unsupported" && (
            <p className="text-primary/60">{t("compass.unsupported")}</p>
          )}
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        <svg
          viewBox="0 0 220 220"
          className="h-auto w-full max-w-[260px]"
          role="img"
          aria-label={t("title")}
        >
          {/* コンパス外周 */}
          <circle
            cx={CX}
            cy={CY}
            r={R}
            className="fill-primary/[0.04] stroke-primary/15"
            strokeWidth={2}
          />
          {/* 正面マーカー（真上＝スマホが向いている方向） */}
          <polygon
            points={`${CX},${CY - R - 2} ${CX - 7},${CY - R + 12} ${CX + 7},${CY - R + 12}`}
            className={cn(aheadActive ? "fill-accent" : "fill-primary/30")}
          />
          {/* 北マーカー（ライブ時はスマホの向きに応じて回る） */}
          {(() => {
            const n = onRing(CX, CY, R - 14, live ? -(heading as number) : 0);
            return (
              <text
                x={n.x}
                y={n.y + 4}
                textAnchor="middle"
                fontSize={12}
                className="fill-primary/40 font-semibold"
              >
                N
              </text>
            );
          })()}

          {/* 目的地を相対方向の位置に配置 */}
          {withRel.map((d) => {
            const p = onRing(CX, CY, R - 30, d.rel);
            const isAhead = ahead?.id === d.id && aheadActive;
            return (
              <g key={d.id}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isAhead ? 9 : 6}
                  className={cn(
                    isAhead ? "fill-accent" : "fill-primary/35",
                    isAhead && "animate-pulse",
                  )}
                />
              </g>
            );
          })}

          {/* 中央：正面方向の矢印 */}
          <g transform={`translate(${CX} ${CY})`}>
            <circle r={26} className="fill-secondary stroke-primary/15" />
            <path
              d="M0,-16 L9,10 L0,4 L-9,10 Z"
              className={cn(aheadActive ? "fill-accent" : "fill-primary/50")}
            />
          </g>
        </svg>

        {/* 正面にある目的地の案内 */}
        <div className="min-h-[3.5rem] w-full text-center">
          {!live ? (
            <p className="text-primary/45 text-sm">{t("faceHint")}</p>
          ) : aheadActive && ahead ? (
            <div className="flex flex-col items-center gap-1.5">
              <p className="font-semibold text-base text-primary">
                {t("aheadIs", { name: ahead.label })}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {ahead.floor && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary/70 text-xs">
                    {ahead.floor}
                  </span>
                )}
                {!ahead.sameFloor && ahead.via && (
                  <span className="rounded-full bg-accent/15 px-2.5 py-0.5 font-medium text-accent text-xs">
                    {ahead.via}
                  </span>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                className="mt-1 gap-1.5"
                onPress={() => setNavGoalId(ahead.id)}
              >
                <Navigation className="size-4" />
                {t("goHere")}
              </Button>
            </div>
          ) : (
            <p className="text-primary/45 text-sm">{t("noneAhead")}</p>
          )}
        </div>
      </div>

      {navGoalId && navRoute.length >= 2 && (
        <CompassGuide
          route={navRoute}
          north={model.north}
          metersPerPx={model.metersPerPx}
          mapNodes={navMapNodes}
          destinationLabel={navGoal?.label ?? null}
          heading={heading}
          sensorState={state}
          onEnableSensor={start}
          onClose={() => setNavGoalId(null)}
        />
      )}
    </InfoCard>
  );
}
