"use client";

import { useEffect, useRef, useState } from "react";
import type { WebRtcStatus } from "../utils/firestoreSignaling";
import { startWebRtcSender, type WebRtcSender } from "../utils/webrtcSender";

type EdgeCameraBroadcastProps = {
  roomId: string;
  stream: MediaStream | null;
};

const STATUS_LABELS: Record<WebRtcStatus, string> = {
  idle: "未配信",
  connecting: "接続中",
  waiting: "待機中",
  negotiating: "接続交渉中",
  connected: "管理画面へ配信中",
  disconnected: "切断",
  error: "エラー",
};

export function EdgeCameraBroadcast({
  roomId,
  stream,
}: EdgeCameraBroadcastProps) {
  const senderRef = useRef<WebRtcSender | null>(null);
  const [status, setStatus] = useState<WebRtcStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    senderRef.current?.stop();
    senderRef.current = null;
    setError(null);

    if (!stream) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    startWebRtcSender({
      roomId,
      stream,
      onStatusChange: setStatus,
      onError: setError,
    })
      .then((sender) => {
        if (cancelled) {
          sender.stop();
          return;
        }
        senderRef.current = sender;
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "配信を開始できません");
        setStatus("error");
      });

    return () => {
      cancelled = true;
      senderRef.current?.stop();
      senderRef.current = null;
    };
  }, [roomId, stream]);

  return (
    <section className="w-full max-w-3xl px-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-neutral-200 border-t pt-4">
        <div>
          <h3 className="font-semibold text-base">エッジ映像共有</h3>
          <p className="text-neutral-600 text-sm">Room: {roomId}</p>
        </div>
        <span className="rounded bg-neutral-900 px-3 py-1 font-medium text-sm text-white">
          {STATUS_LABELS[status]}
        </span>
      </div>
      {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
    </section>
  );
}
