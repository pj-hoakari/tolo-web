"use client";

import { useEffect, useRef, useState } from "react";
import {
  type CameraConnectionAuthorizationError,
  startCameraConnectionAuthorization,
} from "@/features/tenant/webrtc/utils/cameraConnection";

function currentReturnPath(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete("cameraConnection");
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * スタッフのセッションで接続認可が不足しているとき、接続開始 URL へ
 * 一度だけ移動する。マシンのセッションではスタッフの認可を開始できないため
 * 移動しない。
 */
export function useCameraConnectionAuthorization({
  error,
  eventId,
  pageEdgeDeviceId,
}: {
  error: CameraConnectionAuthorizationError | null;
  eventId: string;
  pageEdgeDeviceId: string;
}): { autoStartBlocked: boolean } {
  const [autoStartBlocked, setAutoStartBlocked] = useState(false);
  const startedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (error?.code !== "CONNECTION_AUTHORIZATION_REQUIRED") {
      setAutoStartBlocked(false);
      return;
    }
    if (error.viewerType !== "staff") {
      setAutoStartBlocked(false);
      return;
    }
    const targetEventId = error.eventId ?? eventId;
    const targetPageEdgeDeviceId = error.pageEdgeDeviceId ?? pageEdgeDeviceId;
    const key = `${targetEventId}:${targetPageEdgeDeviceId}`;
    if (startedKeyRef.current === key) {
      return;
    }
    startedKeyRef.current = key;
    const started = startCameraConnectionAuthorization({
      eventId: targetEventId,
      pageEdgeDeviceId: targetPageEdgeDeviceId,
      returnPath: currentReturnPath(),
    });
    setAutoStartBlocked(!started);
  }, [error, eventId, pageEdgeDeviceId]);

  return { autoStartBlocked };
}
