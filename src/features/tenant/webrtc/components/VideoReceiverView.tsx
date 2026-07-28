"use client";

import { type RefObject, useEffect, useRef } from "react";
import type { ConnectionStatus } from "../type";
import { CONNECTION_STATUS_LABEL } from "../utils/connectionStatus";
import {
  type DetectionOverlayFrame,
  drawDetectionOverlay,
} from "../utils/detectionOverlay";

export type VideoReceiverViewProps = {
  stream: MediaStream | null;
  status: ConnectionStatus;
  error: string | null;
  detectionFrameRef?: RefObject<DetectionOverlayFrame | null>;
};

export function VideoReceiverView({
  stream,
  status,
  error,
  detectionFrameRef,
}: VideoReceiverViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const stopped = status === "disconnected";

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // DataChannel で届く検出結果を映像の上に描画する。
  useEffect(() => {
    if (!detectionFrameRef || stopped) {
      return;
    }

    let rafId = 0;
    let lastDrawnFrame: DetectionOverlayFrame | null = null;

    const draw = () => {
      const canvas = overlayCanvasRef.current;
      const frame = detectionFrameRef.current;
      if (canvas && frame !== lastDrawnFrame) {
        lastDrawnFrame = frame;
        const context = canvas.getContext("2d");
        if (context) {
          if (frame && frame.width > 0 && frame.height > 0) {
            if (
              canvas.width !== frame.width ||
              canvas.height !== frame.height
            ) {
              canvas.width = frame.width;
              canvas.height = frame.height;
            }
            context.clearRect(0, 0, canvas.width, canvas.height);
            drawDetectionOverlay(context, frame);
          } else {
            context.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
      }
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [detectionFrameRef, stopped]);

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
              muted
              className="block h-auto w-full rounded bg-black"
            >
              <track kind="captions" />
            </video>
            <canvas
              ref={overlayCanvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
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
