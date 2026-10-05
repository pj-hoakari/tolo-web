"use client";

import { useTranslations } from "next-intl";
import { type RefObject, useEffect, useRef } from "react";
import { useCountingLineEditor } from "@/features/tenant/detection/hooks/useCountingLineEditor";
import type {
  DetectionCountingLineSetting,
  DetectionSettingsStore,
  DetectionViewStateStore,
} from "@/features/tenant/detection/stores/detectionStore";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "../type";
import {
  type DetectionOverlayFrame,
  drawDetectionOverlay,
  toOverlayCountingLines,
} from "../utils/detectionOverlay";

export type VideoReceiverViewProps = {
  stream: MediaStream | null;
  status: ConnectionStatus;
  error: string | null;
  detectionFrameRef?: RefObject<DetectionOverlayFrame | null>;
  /**
   * 渡すとオーバーレイ上でカウントラインを編集できるようになり，
   * ライン自体も受信フレームではなくこのストアの内容で描く。
   * 往復の遅れで操作がもたつかないようにするため。
   */
  settingsStore?: DetectionSettingsStore;
  viewStateStore?: DetectionViewStateStore;
};

export function VideoReceiverView({
  stream,
  status,
  error,
  detectionFrameRef,
  settingsStore,
  viewStateStore,
}: VideoReceiverViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const t = useTranslations("Webrtc.receiver");

  const editable = settingsStore !== undefined && viewStateStore !== undefined;
  const lineEditorHandlers = useCountingLineEditor({
    canvasRef: overlayCanvasRef,
    settingsStore: settingsStore ?? null,
    viewStateStore: viewStateStore ?? null,
  });

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
    let lastDrawnLines: DetectionCountingLineSetting[] | null = null;
    let lastDrawnEditingLineId: string | null | undefined;

    const draw = () => {
      const canvas = overlayCanvasRef.current;
      const frame = detectionFrameRef.current;
      const countingLines = settingsStore
        ? settingsStore.getState().countingLines
        : null;
      const editingLineId = viewStateStore?.getState().editingLineId;

      if (
        canvas &&
        (frame !== lastDrawnFrame ||
          countingLines !== lastDrawnLines ||
          editingLineId !== lastDrawnEditingLineId)
      ) {
        lastDrawnFrame = frame;
        lastDrawnLines = countingLines;
        lastDrawnEditingLineId = editingLineId;
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
            drawDetectionOverlay(
              context,
              countingLines
                ? {
                    ...frame,
                    countingLines: toOverlayCountingLines(
                      countingLines,
                      frame.width,
                      frame.height,
                    ),
                  }
                : frame,
              { highlightedLineId: editingLineId },
            );
          } else {
            context.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
      }
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [detectionFrameRef, stopped, settingsStore, viewStateStore]);

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="relative w-full max-w-3xl">
        {stopped ? (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded bg-muted text-muted-foreground">
            <span className="font-bold">{t("stoppedTitle")}</span>
            <span className="text-sm">{t("stoppedDescription")}</span>
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
              {...(editable ? lineEditorHandlers : {})}
              className={cn(
                "absolute inset-0 h-full w-full rounded",
                editable
                  ? "cursor-crosshair touch-none"
                  : "pointer-events-none",
              )}
            />
            {(status === "connecting" || status === "negotiating") && (
              <div className="absolute inset-0 flex items-center justify-center rounded bg-black/40 text-white">
                {t("connecting")}
              </div>
            )}
          </>
        )}
      </div>
      {status === "error" && error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
