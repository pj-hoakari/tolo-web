"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WebRtcStatus } from "../utils/firestoreSignaling";
import {
  startWebRtcReceiver,
  type WebRtcReceiver,
} from "../utils/webrtcReceiver";

type Edge = {
  id: string;
  name: string;
  location: string;
};

type EdgeCameraMonitorProps = {
  tenantId: string;
  eventId: string;
};

const EDGES: Edge[] = [
  { id: "edge-main", name: "メイン入口", location: "入口列・受付前" },
  { id: "edge-hall", name: "ホール通路", location: "会場内の交錯ポイント" },
  { id: "edge-exit", name: "出口導線", location: "退場列・物販出口" },
];

const STATUS_LABELS: Record<WebRtcStatus, string> = {
  idle: "未接続",
  connecting: "接続中",
  waiting: "エッジ待機中",
  negotiating: "接続交渉中",
  connected: "ライブ映像",
  disconnected: "切断",
  error: "エラー",
};

function createRoomId(tenantId: string, eventId: string, edgeId: string) {
  return `${tenantId}:${eventId}:${edgeId}`;
}

export function EdgeCameraMonitor({
  tenantId,
  eventId,
}: EdgeCameraMonitorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const receiverRef = useRef<WebRtcReceiver | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(EDGES[0].id);
  const [status, setStatus] = useState<WebRtcStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const selectedEdge =
    EDGES.find((edge) => edge.id === selectedEdgeId) ?? EDGES[0];
  const roomId = useMemo(
    () => createRoomId(tenantId, eventId, selectedEdgeId),
    [tenantId, eventId, selectedEdgeId],
  );

  useEffect(() => {
    receiverRef.current?.stop();
    receiverRef.current = null;
    setError(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    let cancelled = false;
    startWebRtcReceiver({
      roomId,
      onRemoteStream: (stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      },
      onStatusChange: setStatus,
      onError: setError,
    })
      .then((receiver) => {
        if (cancelled) {
          receiver.stop();
          return;
        }
        receiverRef.current = receiver;
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "映像を受信できません");
        setStatus("error");
      });

    return () => {
      cancelled = true;
      receiverRef.current?.stop();
      receiverRef.current = null;
    };
  }, [roomId]);

  return (
    <div className="grid min-h-screen grid-cols-[280px_1fr] bg-neutral-950 text-white">
      <aside className="border-neutral-800 border-r p-5">
        <div className="mb-6">
          <p className="font-semibold text-neutral-400 text-sm">TOLO Admin</p>
          <h1 className="mt-1 font-bold text-2xl">エッジ監視</h1>
          <p className="mt-2 text-neutral-400 text-sm">
            {tenantId} / {eventId}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {EDGES.map((edge) => (
            <button
              key={edge.id}
              type="button"
              onClick={() => setSelectedEdgeId(edge.id)}
              className={`rounded border p-3 text-left transition ${
                selectedEdgeId === edge.id
                  ? "border-cyan-300 bg-cyan-300 text-neutral-950"
                  : "border-neutral-800 bg-neutral-900 hover:bg-neutral-800"
              }`}
            >
              <span className="block font-semibold">{edge.name}</span>
              <span className="mt-1 block text-sm opacity-75">
                {edge.location}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex flex-col gap-4 p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-2xl">{selectedEdge.name}</h2>
            <p className="mt-1 text-neutral-400">{selectedEdge.location}</p>
            <p className="mt-1 text-neutral-500 text-sm">Room: {roomId}</p>
          </div>
          <span className="rounded bg-white px-3 py-1 font-medium text-neutral-950 text-sm">
            {STATUS_LABELS[status]}
          </span>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded border border-neutral-800 bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full min-h-[520px] w-full object-contain"
          >
            <track kind="captions" />
          </video>
          {status !== "connected" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55">
              <p className="font-medium text-lg">{STATUS_LABELS[status]}</p>
            </div>
          )}
        </div>

        {error && <p className="text-red-300">{error}</p>}
      </main>
    </div>
  );
}
