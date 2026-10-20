"use client";

import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Compass,
  Flag,
  MapPin,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { GuideMapPoint } from "./guideMapSchema";
import type { HeadingState } from "./useHeading";

/**
 * コンパス誘導（スマホ向け）。
 * 位置情報は使わず、端末の「向き（方位）」だけを使って「こっちへ進む」を矢印で示す。
 * ステップは手動送り（位置が取れないため到着の自動判定はできない）。
 *
 * TODO: マップに「北」の基準（作成ツールの north）を持たせたら、その値を north に渡す。
 *       いまは「マップの上＝北」（north = 0）として計算している。
 */

/** 3 点 a→b→c から b での曲がる向きを判定（画面座標＝y 下向き） */
function turnAt(a: GuideMapPoint, b: GuideMapPoint, c: GuideMapPoint) {
  const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
  const ang = (Math.atan2(cross, dot) * 180) / Math.PI;
  if (Math.abs(ang) < 25) return "straight" as const;
  return ang > 0 ? ("right" as const) : ("left" as const);
}

/** a→b の方位角（0=北・時計回り）。north はマップ上向きが指す方位角。 */
function bearingOf(a: GuideMapPoint, b: GuideMapPoint, north: number) {
  const fromUp = (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI;
  return (((fromUp + north) % 360) + 360) % 360;
}

type StepKind = "start" | "right" | "left" | "straight" | "arrive";
type Step = {
  n: number;
  kind: StepKind;
  bearing: number | null;
  /** このステップの地点（曲がり角 or 地点）の座標 */
  pos: GuideMapPoint;
};

function distPx(a: GuideMapPoint, b: GuideMapPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
/** メートルを「約◯m」向けに丸める（5m 刻み） */
function roundM(m: number) {
  return m >= 100
    ? Math.round(m / 10) * 10
    : Math.max(5, Math.round(m / 5) * 5);
}

/** ルートの折れ線から、曲がり角ごとのステップを作る（直進の頂点は省く） */
function buildSteps(route: GuideMapPoint[], north: number): Step[] {
  if (route.length < 2) return [];
  const kept = route.filter((p, i) => {
    if (i === 0 || i === route.length - 1) return true;
    return turnAt(route[i - 1], p, route[i + 1]) !== "straight";
  });
  const steps: Step[] = [];
  for (let i = 0; i < kept.length; i++) {
    const prev = kept[i - 1];
    const next = kept[i + 1];
    const bearing = next ? bearingOf(kept[i], next, north) : null;
    let kind: StepKind = "straight";
    if (i === 0) kind = "start";
    else if (i === kept.length - 1) kind = "arrive";
    else if (prev && next) {
      const t = turnAt(prev, kept[i], next);
      kind = t === "right" ? "right" : t === "left" ? "left" : "straight";
    }
    steps.push({ n: i + 1, kind, bearing, pos: kept[i] });
  }
  return steps;
}

/** ミニマップ用に見せる地点（中心座標＋大きさ）。位置関係の把握に使う */
export type CompassMapNode = { x: number; y: number; w: number; h: number };

export type CompassGuideProps = {
  route: GuideMapPoint[];
  destinationLabel?: string | null;
  /** マップの上が指す方位角（0=北・時計回り）。既定は 0（上＝北）。 */
  north?: number;
  /** 1px あたりのメートル数。0/未指定なら距離は表示しない。 */
  metersPerPx?: number;
  /** ミニマップに薄く描く周辺の地点（任意）。 */
  mapNodes?: CompassMapNode[];
  /** 端末の方位（0=北・時計回り）。null なら未取得。親の useHeading から渡す */
  heading: number | null;
  /** 方位センサーの状態。親の useHeading から渡す */
  sensorState: HeadingState;
  /** 方位センサーの再許可（denied/unsupported 時の再試行用）。ユーザー操作で呼ぶ */
  onEnableSensor: () => void;
  onClose: () => void;
};

export function CompassGuide({
  route,
  destinationLabel,
  north = 0,
  metersPerPx = 0,
  mapNodes,
  heading,
  sensorState,
  onEnableSensor,
  onClose,
}: CompassGuideProps) {
  const t = useTranslations("Guest.guideMap.compass");
  const steps = useMemo(() => buildSteps(route, north), [route, north]);
  const [index, setIndex] = useState(0);

  // ルート全体の距離・徒歩時間（縮尺があるときだけ）
  const totalMeters = useMemo(() => {
    if (metersPerPx <= 0 || route.length < 2) return 0;
    let px = 0;
    for (let i = 1; i < route.length; i++) px += distPx(route[i - 1], route[i]);
    return px * metersPerPx;
  }, [route, metersPerPx]);
  const walkMinutes =
    totalMeters > 0 ? Math.max(1, Math.round(totalMeters / 80)) : 0;

  // ミニマップの表示範囲（ルートの外接矩形＋余白）
  // ミニマップの表示範囲。回転(ヘディングアップ)で角が切れないよう正方形＋余白多め。
  const view = useMemo(() => {
    if (route.length < 2) return null;
    const xs = route.map((p) => p.x);
    const ys = route.map((p) => p.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const extent = Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
      1,
    );
    const side = extent * 1.5 + 48;
    return {
      x: cx - side / 2,
      y: cy - side / 2,
      w: side,
      h: side,
      dot: side / 30,
    };
  }, [route]);

  const step = steps[index];
  const last = index === steps.length - 1;
  if (!step) return null;

  const nextMeters =
    !last && metersPerPx > 0 && steps[index + 1]
      ? distPx(step.pos, steps[index + 1].pos) * metersPerPx
      : 0;

  // 矢印は「次の曲がり角（道中の目的地）」の方向を指す。端末の向きに追従する。
  // 「次へ」を押すたびに基準がその角へ移るので、各区間の方角は正確に保たれる。
  const live = sensorState === "on" && heading != null && step.bearing != null;
  const arrowDeg =
    step.bearing == null
      ? 0
      : live
        ? step.bearing - (heading ?? 0)
        : step.bearing;

  // ミニマップのヘディングアップ回転。向いている方位が常に上になるよう地図を回す。
  const mapLive = sensorState === "on" && heading != null;
  const mapRotation = mapLive ? north - (heading ?? 0) : 0;

  const stepTitle =
    step.kind === "start"
      ? t("start")
      : step.kind === "arrive"
        ? destinationLabel
          ? `${t("arrive")}：${destinationLabel}`
          : t("arrive")
        : step.kind === "right"
          ? t("turnRight")
          : step.kind === "left"
            ? t("turnLeft")
            : t("straight");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-primary/25 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-primary/12 bg-white p-4 text-primary">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 font-semibold text-base">
            <Compass className="size-5 text-primary" />
            {t("title")}
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("close")}
            onPress={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        {totalMeters > 0 && (
          <p className="mb-2 text-primary/60 text-xs">
            {t("distanceTotal", { m: roundM(totalMeters), min: walkMinutes })}
          </p>
        )}

        {sensorState !== "on" && (
          <div className="mb-3 rounded-lg border border-primary/12 p-2 text-sm">
            {(sensorState === "idle" || sensorState === "denied") && (
              <Button
                type="button"
                size="sm"
                className="w-full"
                onPress={onEnableSensor}
              >
                <Compass className="mr-1.5 size-4" />
                {sensorState === "denied" ? t("retrySensor") : t("enable")}
              </Button>
            )}
            {sensorState === "denied" && (
              <p className="mt-1 text-primary/60">{t("denied")}</p>
            )}
            {sensorState === "unsupported" && (
              <p className="text-primary/60">{t("unsupported")}</p>
            )}
          </div>
        )}

        <div className="flex flex-col items-center gap-2 py-2">
          <div className="relative grid size-40 place-items-center rounded-full border-4 border-accent">
            {step.bearing == null ? (
              <Flag className="size-16 text-primary" />
            ) : (
              <ArrowUp
                className="size-24 text-primary transition-transform duration-200"
                strokeWidth={2.5}
                style={{ transform: `rotate(${arrowDeg}deg)` }}
              />
            )}
            {live && (
              <span
                className="absolute font-semibold text-[10px] text-primary/60"
                style={{
                  transform: `rotate(${-(heading ?? 0)}deg) translateY(-4.75rem)`,
                }}
              >
                N
              </span>
            )}
          </div>
          {!live && step.bearing != null && (
            <p className="text-[11px] text-primary/50">{t("northUpNote")}</p>
          )}
        </div>

        <div className="mt-2 flex items-center gap-3 rounded-xl border border-primary/12 p-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-secondary text-sm">
            {step.kind === "start" ? (
              <MapPin className="size-4" />
            ) : step.kind === "arrive" ? (
              <Flag className="size-4" />
            ) : (
              step.n
            )}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-base">{stepTitle}</p>
            {nextMeters > 0 && (
              <p className="text-primary/70 text-xs">
                {t("distanceNext", { m: roundM(nextMeters) })}
              </p>
            )}
            {step.kind !== "arrive" && (
              <p className="text-primary/55 text-xs">{t("advanceHint")}</p>
            )}
          </div>
        </div>

        {view && (
          <div className="relative mx-auto mt-3 aspect-square w-44 overflow-hidden rounded-xl border border-primary/12 bg-white">
            <svg
              viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
              className="h-full w-full transition-transform duration-200"
              style={{ transform: `rotate(${mapRotation}deg)` }}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={t("overview")}
            >
              {(mapNodes ?? []).map((n) => (
                <rect
                  key={`${n.x}-${n.y}-${n.w}-${n.h}`}
                  x={n.x - n.w / 2}
                  y={n.y - n.h / 2}
                  width={n.w}
                  height={n.h}
                  rx={Math.min(n.w, n.h) * 0.18}
                  className="fill-primary/10"
                />
              ))}
              <polyline
                points={route.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                className="stroke-primary"
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={route[0].x}
                cy={route[0].y}
                r={view.dot}
                className="fill-accent stroke-primary"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={route[route.length - 1].x}
                cy={route[route.length - 1].y}
                r={view.dot}
                className="fill-primary"
              />
              <circle
                cx={step.pos.x}
                cy={step.pos.y}
                r={view.dot * 1.6}
                className="fill-none stroke-primary"
                strokeWidth={2.5}
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={step.pos.x}
                cy={step.pos.y}
                r={view.dot * 0.7}
                className="fill-primary"
              />
            </svg>
            {mapLive ? (
              // ヘディングアップ中: 画面の上＝進行方向（向いている方向）
              <span className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 text-primary/70">
                <ArrowUp className="size-4" />
              </span>
            ) : (
              // 固定表示: 北が上
              <span className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 font-semibold text-[10px] text-primary/50">
                N
              </span>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onPress={() =>
              index === 0 ? onClose() : setIndex((v) => Math.max(0, v - 1))
            }
          >
            <ChevronLeft className="mr-1 size-4" />
            {t("back")}
          </Button>
          <span className="text-primary/55 text-xs tabular-nums">
            {t("stepOf", { current: index + 1, total: steps.length })}
          </span>
          {last ? (
            <Button type="button" size="sm" onPress={onClose}>
              {t("finish")}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onPress={() => setIndex((v) => Math.min(steps.length - 1, v + 1))}
            >
              {t("arrivedNext")}
              <ChevronRight className="ml-1 size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
