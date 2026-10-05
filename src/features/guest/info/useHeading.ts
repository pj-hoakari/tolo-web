"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 端末の「向き（方位）」を取得するフック。
 * 位置情報は使わず、方位センサーだけで「スマホの上辺が今どの方角を向いているか」を返す。
 *
 * iOS 13+ は許可取得にユーザー操作が必須のため、start() は必ずタップ等の
 * ジェスチャ内（＝コンパスを開くボタンの onPress など）から呼ぶこと。
 */
export type HeadingState = "idle" | "on" | "denied" | "unsupported";

export type UseHeadingResult = {
  /** 0=北・時計回りの方位角。未取得なら null */
  heading: number | null;
  state: HeadingState;
  /** 計測開始（許可要求を含む）。ユーザー操作のハンドラ内から呼ぶ */
  start: () => void;
  /** 計測停止（リスナ解除）。コンパスを閉じるときに呼ぶ */
  stop: () => void;
};

type DeviceOrientationEventWithHeading = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};
type DeviceOrientationEventStatic = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
};

export function useHeading(): UseHeadingResult {
  const [heading, setHeading] = useState<number | null>(null);
  const [state, setState] = useState<HeadingState>("idle");
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
    // 既にリスナがあるなら張り直し（多重登録を防ぐ）
    if (handlerRef.current) stop();

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
  }, [stop]);

  // アンマウント時にリスナを解除
  useEffect(() => stop, [stop]);

  return { heading, state, start, stop };
}
