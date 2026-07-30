import { type RefObject, useCallback, useEffect, useRef } from "react";
import {
  applyLineCounts,
  applyMetrics,
  areCountingLinesEqual,
  createInitialLineCounts,
  type DetectionResultStore,
  type DetectionSettingsStore,
  INITIAL_LINE_COUNT,
  INITIAL_METRICS,
} from "@/features/tenant/detection/stores/detectionStore";
import {
  type DetectionOverlayFrame,
  drawDetectionOverlay,
  toOverlayCountingLines,
} from "@/features/tenant/webrtc/utils/detectionOverlay";
import {
  type BroadcastStreamHandle,
  createBroadcastStream,
} from "../utils/broadcastStream";
import {
  type CrowdCountingLine,
  type CrowdDetectionFrame,
  detectCrowdFrame,
  resetCrowdLineCount,
} from "../utils/detectCrowd";
import type { DetectCrowdStatus } from "./useDetectCrowd";

function syncCanvasSize(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): void {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function toDetectionOverlayFrame(
  frame: CrowdDetectionFrame | null,
  countingLines: CrowdCountingLine[],
  width: number,
  height: number,
): DetectionOverlayFrame {
  return {
    width,
    height,
    detections: (frame?.detections ?? []).map(
      ({ trackId, score, x1, y1, x2, y2 }) => ({
        trackId,
        score,
        x1,
        y1,
        x2,
        y2,
      }),
    ),
    countingLines,
    lineCounts:
      frame?.lineCounts ??
      Object.fromEntries(
        countingLines.map((line) => [line.id, INITIAL_LINE_COUNT]),
      ),
  };
}

export type UseCrowdDetectionLoopParams = {
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
  status: DetectCrowdStatus;
  settingsStore: DetectionSettingsStore;
  resultStore: DetectionResultStore;
  onBroadcastStreamChange: (stream: MediaStream | null) => void;
  onDetectionFrame: (frame: DetectionOverlayFrame | null) => void;
  onDetectionError: (cause: unknown) => void;
};

/**
 * 検出ループ
 *
 * 検出結果（追跡人数 / FPS / ライン通過数）は React state ではなく
 * resultStore に書き込む。
 * 設定も settingsStore から直接読み，設定変更のたびにループを
 * 組み直さないようにする。
 * 検出のたびに onDetectionFrame へオーバーレイ用フレームを渡し，
 * 配信先（management）でのボックス描画に使う。
 */
export function useCrowdDetectionLoop({
  videoRef,
  overlayCanvasRef,
  status,
  settingsStore,
  resultStore,
  onBroadcastStreamChange,
  onDetectionFrame,
  onDetectionError,
}: UseCrowdDetectionLoopParams): void {
  const broadcastRef = useRef<BroadcastStreamHandle | null>(null);
  const latestFrameRef = useRef<CrowdDetectionFrame | null>(null);

  // カウントラインが変わったら通過数を数え直す
  useEffect(() => {
    let previousCountingLines = settingsStore.getState().countingLines;

    return settingsStore.subscribe(() => {
      const nextCountingLines = settingsStore.getState().countingLines;
      if (areCountingLinesEqual(previousCountingLines, nextCountingLines)) {
        return;
      }
      previousCountingLines = nextCountingLines;

      latestFrameRef.current = null;
      resetCrowdLineCount();
      applyLineCounts(resultStore, createInitialLineCounts(nextCountingLines));
    });
  }, [settingsStore, resultStore]);

  const stopBroadcast = useCallback(() => {
    onDetectionFrame(null);
    const broadcast = broadcastRef.current;
    if (!broadcast) {
      return;
    }
    broadcast.dispose();
    for (const track of broadcast.stream.getTracks()) {
      track.stop();
    }
    broadcastRef.current = null;
    onBroadcastStreamChange(null);
  }, [onBroadcastStreamChange, onDetectionFrame]);

  useEffect(() => {
    if (status !== "detecting") {
      const canvas = overlayCanvasRef.current;
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      latestFrameRef.current = null;
      applyLineCounts(
        resultStore,
        createInitialLineCounts(settingsStore.getState().countingLines),
      );
      applyMetrics(resultStore, INITIAL_METRICS);
      stopBroadcast();
      return;
    }

    let cancelled = false;
    let detectTimeoutId = 0;
    let renderRafId = 0;
    let previousDetectionAt = performance.now();

    const isVideoReady = (
      video: HTMLVideoElement | null,
    ): video is HTMLVideoElement =>
      !!video &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.videoWidth > 0 &&
      video.videoHeight > 0;

    const detectLoop = async () => {
      if (cancelled) {
        return;
      }
      const video = videoRef.current;
      if (!isVideoReady(video)) {
        detectTimeoutId = window.setTimeout(
          detectLoop,
          settingsStore.getState().detectionInterval,
        );
        return;
      }

      try {
        const currentSettings = settingsStore.getState();
        const countingLines = toOverlayCountingLines(
          currentSettings.countingLines,
          video.videoWidth,
          video.videoHeight,
        );
        const frame = await detectCrowdFrame(video, {
          confidenceThreshold: currentSettings.confidenceThreshold,
          trackingDistanceThreshold: currentSettings.trackingDistanceThreshold,
          countingLines,
        });

        if (cancelled) {
          return;
        }

        latestFrameRef.current = frame;

        applyLineCounts(resultStore, frame.lineCounts);
        const detectionAt = performance.now();
        const fps = 1000 / Math.max(1, detectionAt - previousDetectionAt);
        previousDetectionAt = detectionAt;
        applyMetrics(resultStore, {
          trackedCount: frame.detections.length,
          fps,
        });
        onDetectionFrame(
          toDetectionOverlayFrame(
            frame,
            countingLines,
            video.videoWidth,
            video.videoHeight,
          ),
        );
      } catch (cause) {
        if (!cancelled) {
          onDetectionError(cause);
        }
        return;
      }

      detectTimeoutId = window.setTimeout(
        detectLoop,
        settingsStore.getState().detectionInterval,
      );
    };

    const renderLoop = () => {
      if (cancelled) {
        return;
      }
      const video = videoRef.current;

      if (isVideoReady(video)) {
        const width = video.videoWidth;
        const height = video.videoHeight;
        const countingLines = toOverlayCountingLines(
          settingsStore.getState().countingLines,
          width,
          height,
        );

        const overlay = overlayCanvasRef.current;
        if (overlay) {
          syncCanvasSize(overlay, width, height);
          const context = overlay.getContext("2d");
          if (context) {
            context.clearRect(0, 0, width, height);
            drawDetectionOverlay(
              context,
              toDetectionOverlayFrame(
                latestFrameRef.current,
                countingLines,
                width,
                height,
              ),
            );
          }
        }

        if (!broadcastRef.current) {
          const broadcast = createBroadcastStream(video);
          if (broadcast) {
            for (const track of broadcast.stream.getVideoTracks()) {
              track.contentHint = "motion";
            }
            broadcastRef.current = broadcast;
            onBroadcastStreamChange(broadcast.stream);
          }
        }
      }

      renderRafId = requestAnimationFrame(renderLoop);
    };

    detectLoop().catch((cause) => {
      if (!cancelled) {
        onDetectionError(cause);
      }
    });
    renderRafId = requestAnimationFrame(renderLoop);

    return () => {
      cancelled = true;
      clearTimeout(detectTimeoutId);
      cancelAnimationFrame(renderRafId);
      stopBroadcast();
    };
  }, [
    status,
    onDetectionError,
    onBroadcastStreamChange,
    onDetectionFrame,
    stopBroadcast,
    videoRef,
    overlayCanvasRef,
    settingsStore,
    resultStore,
  ]);
}
