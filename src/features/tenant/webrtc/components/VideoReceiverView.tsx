"use client";

import { useEffect, useRef } from "react";
import type { ConnectionStatus } from "../type";
import { CONNECTION_STATUS_LABEL } from "../utils/connectionStatus";

export type VideoReceiverViewProps = {
  stream: MediaStream | null;
  status: ConnectionStatus;
  error: string | null;
};

export function VideoReceiverView({
  stream,
  status,
  error,
}: VideoReceiverViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const stopped = status === "disconnected";

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="relative w-full max-w-3xl">
        {stopped ? (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded bg-gray-100 text-gray-600">
            <span className="font-bold">観測が停止しました</span>
            <span className="text-sm">配信元のカメラが停止されました</span>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="aspect-video w-full rounded bg-black"
            >
              <track kind="captions" />
            </video>
            {(status === "connecting" || status === "negotiating") && (
              <div className="absolute inset-0 flex items-center justify-center rounded bg-black/40 text-white">
                接続中…
              </div>
            )}
          </>
        )}
      </div>
      <span className="text-gray-600 text-sm">
        状態: {CONNECTION_STATUS_LABEL[status]}
      </span>
      {status === "error" && error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
