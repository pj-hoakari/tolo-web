"use client";

import { useEffect, useRef } from "react";

/**
 * ESP モードで委任カメラが利用可能になったら、一度だけ自動で接続を開始する。
 * カメラの構成が変わったときは、新しい構成でもう一度だけ開始する。
 */
export function useEspCameraAutoStart({
  enabled,
  cameraIds,
  start,
}: {
  enabled: boolean;
  cameraIds: readonly string[];
  start: () => void;
}): void {
  const startRef = useRef(start);
  startRef.current = start;
  const startedKeyRef = useRef<string | null>(null);

  const cameraKey =
    enabled && cameraIds.length > 0 ? cameraIds.join(",") : null;

  useEffect(() => {
    if (cameraKey === null) {
      startedKeyRef.current = null;
      return;
    }
    if (startedKeyRef.current === cameraKey) {
      return;
    }
    startedKeyRef.current = cameraKey;
    startRef.current();
  }, [cameraKey]);
}
