"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

export type UseScreenWakeLockResult = {
  isSupported: boolean;
  enabled: boolean;
  isActive: boolean;
  error: string | null;
  /** 画面ロックの取得を要求
   * iOS Safari ではユーザー操作が必須，ユーザー操作のイベントハンドラ内から呼び出し */
  enable: () => Promise<void>;
  disable: () => Promise<void>;
};

/**
 * Screen Wake Lock API で画面の自動消灯を防ぐフック
 *
 * Screen Wake Lock の取得は visible な document が前提
 * 特に iOS Safari ではユーザー操作下でしか許可されない
 * 取得はユーザー操作起点の {@link enable} 経由で行う必要がある
 */
export function useScreenWakeLock(): UseScreenWakeLockResult {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const enabledRef = useRef(false);
  const [isSupported, setIsSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("Observation.screenWake");

  // 対応判定はクライアントでのみ
  useEffect(() => {
    setIsSupported(typeof navigator !== "undefined" && "wakeLock" in navigator);
  }, []);

  const acquire = useCallback(async () => {
    if (
      sentinelRef.current !== null ||
      document.visibilityState !== "visible"
    ) {
      return;
    }

    try {
      // 重要: request の手前で await を挟まない。iOS Safari の transient activation を
      // 失わないよう、本関数はユーザー操作のイベントハンドラ起点で呼ぶこと。
      const acquired = await navigator.wakeLock.request("screen");
      sentinelRef.current = acquired;
      setIsActive(true);
      setError(null);

      acquired.addEventListener("release", () => {
        if (sentinelRef.current === acquired) {
          sentinelRef.current = null;
          setIsActive(false);
        }
      });
    } catch (e) {
      setIsActive(false);
      setError(e instanceof Error ? e.message : t("enableError"));
    }
  }, [t]);

  const enable = useCallback(async () => {
    enabledRef.current = true;
    setEnabled(true);
    setError(null);
    await acquire();
  }, [acquire]);

  const disable = useCallback(async () => {
    enabledRef.current = false;
    setEnabled(false);

    const current = sentinelRef.current;
    sentinelRef.current = null;
    setIsActive(false);
    if (current !== null) {
      try {
        await current.release();
      } catch {
        // すでに解放済み等
        // 無視
      }
    }
  }, []);

  // タブ復帰時、有効化済みであればロックを取り直す
  useEffect(() => {
    if (!isSupported) {
      return;
    }
    const handleVisibilityChange = () => {
      if (enabledRef.current && document.visibilityState === "visible") {
        void acquire();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isSupported, acquire]);

  useEffect(() => {
    return () => {
      const current = sentinelRef.current;
      sentinelRef.current = null;
      if (current !== null) {
        void current.release();
      }
    };
  }, []);

  return { isSupported, enabled, isActive, error, enable, disable };
}
