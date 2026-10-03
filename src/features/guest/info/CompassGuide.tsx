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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GuideMapPoint } from "./guideMapSchema";

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
type Step = { n: number; kind: StepKind; bearing: number | null };

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
    steps.push({ n: i + 1, kind, bearing });
  }
  return steps;
}

// iOS / Android 差を吸収した方位取得
type DeviceOrientationEventWithHeading = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};
type DeviceOrientationEventStatic = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
};

function useHeading() {
  const [heading, setHeading] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "on" | "denied" | "unsupported">(
    "idle",
  );
  const handlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);

  const stop = useCallback(() => {
    if (handlerRef.current) {
      window.removeEventListener(
        "deviceorientationabsolute",
        handlerRef.current as EventListener,
      );
      window.removeEventListener(
        "deviceorientation",
        handlerRef.current as EventListener,
      );
      handlerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    const orientation = (
      typeof window !== "undefined" ? window.DeviceOrientationEvent : undefined
    ) as DeviceOrientationEventStatic | undefined;
    if (!orientation) {
      setState("unsupported");
      return;
    }
    try {
      if (typeof orientation.requestPermission === "function") {
        const res = await orientation.requestPermission();
        if (res !== "granted") {
          setState("denied");
          return;
        }
      }
    } catch {
      setState("unsupported");
      return;
    }
    const handler = (e: DeviceOrientationEvent) => {
      const ev = e as DeviceOrientationEventWithHeading;
      let h: number | null = null;
      if (typeof ev.webkitCompassHeading === "number") {
        h = ev.webkitCompassHeading;
      } else if (ev.absolute && typeof ev.alpha === "number") {
        h = (360 - ev.alpha) % 360;
      }
      if (h != null && !Number.isNaN(h)) setHeading(((h % 360) + 360) % 360);
    };
    handlerRef.current = handler;
    window.addEventListener(
      "deviceorientationabsolute",
      handler as EventListener,
    );
    window.addEventListener("deviceorientation", handler as EventListener);
    setState("on");
  }, []);

  useEffect(() => stop, [stop]);
  return { heading, state, start };
}

export type CompassGuideProps = {
  route: GuideMapPoint[];
  destinationLabel?: string | null;
  /** マップの上が指す方位角（0=北・時計回り）。既定は 0（上＝北）。 */
  north?: number;
  onClose: () => void;
};

export function CompassGuide({
  route,
  destinationLabel,
  north = 0,
  onClose,
}: CompassGuideProps) {
  const t = useTranslations("Guest.guideMap.compass");
  const steps = useMemo(() => buildSteps(route, north), [route, north]);
  const [index, setIndex] = useState(0);
  const { heading, state, start } = useHeading();

  const step = steps[index];
  const last = index === steps.length - 1;
  if (!step) return null;

  const live = state === "on" && heading != null && step.bearing != null;
  const arrowDeg =
    step.bearing == null
      ? 0
      : live
        ? step.bearing - (heading ?? 0)
        : step.bearing;

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

        {state !== "on" && (
          <div className="mb-3 rounded-lg border border-primary/12 p-2 text-sm">
            {state === "idle" && (
              <Button
                type="button"
                size="sm"
                className="w-full"
                onPress={start}
              >
                <Compass className="mr-1.5 size-4" />
                {t("enable")}
              </Button>
            )}
            {state === "denied" && (
              <p className="text-primary/60">{t("denied")}</p>
            )}
            {state === "unsupported" && (
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
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full font-semibold text-secondary text-sm",
              "bg-accent",
            )}
          >
            {step.kind === "start" ? (
              <MapPin className="size-4" />
            ) : step.kind === "arrive" ? (
              <Flag className="size-4" />
            ) : (
              step.n
            )}
          </span>
          <p className="min-w-0 font-semibold text-base">{stepTitle}</p>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            isDisabled={index === 0}
            onPress={() => setIndex((v) => Math.max(0, v - 1))}
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
              {t("next")}
              <ChevronRight className="ml-1 size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
