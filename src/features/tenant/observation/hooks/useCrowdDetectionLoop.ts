import { type RefObject, useCallback, useEffect, useRef } from "react";
import {
  applyLineCounts,
  applyMetrics,
  areCountingLinesEqual,
  clampUnit,
  createInitialLineCounts,
  type DetectionCountingLineSetting,
  type DetectionResultStore,
  type DetectionSettingsStore,
  INITIAL_METRICS,
} from "../stores/detectionStore";
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

export function toCrowdCountingLine(
  countingLine: DetectionCountingLineSetting,
  width: number,
  height: number,
): CrowdCountingLine {
  return {
    id: countingLine.id,
    p1: {
      x: clampUnit(countingLine.p1.x) * width,
      y: clampUnit(countingLine.p1.y) * height,
    },
    p2: {
      x: clampUnit(countingLine.p2.x) * width,
      y: clampUnit(countingLine.p2.y) * height,
    },
  };
}

export function toCrowdCountingLines(
  countingLines: DetectionCountingLineSetting[],
  width: number,
  height: number,
): CrowdCountingLine[] {
  return countingLines.map((countingLine) =>
    toCrowdCountingLine(countingLine, width, height),
  );
}

function drawCountingLine(
  context: CanvasRenderingContext2D,
  countingLine: CrowdCountingLine,
  width: number,
): void {
  context.lineWidth = Math.max(2, width / 320);
  context.strokeStyle = "#f59e0b";
  context.fillStyle = "#f59e0b";
  context.setLineDash([12, 8]);
  context.beginPath();
  context.moveTo(countingLine.p1.x, countingLine.p1.y);
  context.lineTo(countingLine.p2.x, countingLine.p2.y);
  context.stroke();
  context.setLineDash([]);

  const handleRadius = Math.max(6, width / 96);
  context.beginPath();
  context.arc(
    countingLine.p1.x,
    countingLine.p1.y,
    handleRadius,
    0,
    Math.PI * 2,
  );
  context.arc(
    countingLine.p2.x,
    countingLine.p2.y,
    handleRadius,
    0,
    Math.PI * 2,
  );
  context.fill();
}

function drawDetectionOverlay(
  context: CanvasRenderingContext2D,
  frame: CrowdDetectionFrame,
  countingLines: CrowdCountingLine[],
  width: number,
): void {
  for (const countingLine of countingLines) {
    drawCountingLine(context, countingLine, width);
  }

  context.font = `${Math.max(16, width / 40)}px sans-serif`;

  for (const detection of frame.detections) {
    const boxWidth = detection.x2 - detection.x1;
    const boxHeight = detection.y2 - detection.y1;
    const label = `Person #${detection.trackId} ${Math.round(
      detection.score * 100,
    )}%`;

    context.strokeStyle = "#22c55e";
    context.strokeRect(detection.x1, detection.y1, boxWidth, boxHeight);

    const labelWidth = context.measureText(label).width + 12;
    const labelHeight = Math.max(22, width / 32);
    const labelY = Math.max(0, detection.y1 - labelHeight);
    context.fillStyle = "#22c55e";
    context.fillRect(detection.x1, labelY, labelWidth, labelHeight);
    context.fillStyle = "#052e16";
    context.fillText(label, detection.x1 + 6, labelY + labelHeight - 6);
  }
}

export type UseCrowdDetectionLoopParams = {
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
  status: DetectCrowdStatus;
  settingsStore: DetectionSettingsStore;
  resultStore: DetectionResultStore;
  onBroadcastStreamChange: (stream: MediaStream | null) => void;
  onDetectionError: (cause: unknown) => void;
};

/**
 * 検出ループ
 *
 * 検出結果（追跡人数 / FPS / ライン通過数）は React state ではなく
 * resultStore に書き込む。
 * 設定も settingsStore から直接読み，設定変更のたびにループを
 * 組み直さないようにする。
 */
export function useCrowdDetectionLoop({
  videoRef,
  overlayCanvasRef,
  status,
  settingsStore,
  resultStore,
  onBroadcastStreamChange,
  onDetectionError,
}: UseCrowdDetectionLoopParams): void {
  const broadcastCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const broadcastStreamRef = useRef<MediaStream | null>(null);
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
    if (!broadcastStreamRef.current) {
      return;
    }
    for (const track of broadcastStreamRef.current.getTracks()) {
      track.stop();
    }
    broadcastStreamRef.current = null;
    onBroadcastStreamChange(null);
  }, [onBroadcastStreamChange]);

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
        const countingLines = toCrowdCountingLines(
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
        const frame = latestFrameRef.current;
        const countingLines = toCrowdCountingLines(
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
            if (frame) {
              drawDetectionOverlay(context, frame, countingLines, width);
            } else {
              for (const countingLine of countingLines) {
                drawCountingLine(context, countingLine, width);
              }
            }
          }
        }

        let broadcastCanvas = broadcastCanvasRef.current;
        if (!broadcastCanvas) {
          broadcastCanvas = document.createElement("canvas");
          broadcastCanvasRef.current = broadcastCanvas;
        }
        syncCanvasSize(broadcastCanvas, width, height);
        const broadcastContext = broadcastCanvas.getContext("2d");
        if (broadcastContext) {
          broadcastContext.drawImage(video, 0, 0, width, height);
          if (frame) {
            drawDetectionOverlay(broadcastContext, frame, countingLines, width);
          } else {
            for (const countingLine of countingLines) {
              drawCountingLine(broadcastContext, countingLine, width);
            }
          }
          if (!broadcastStreamRef.current) {
            broadcastStreamRef.current = broadcastCanvas.captureStream();
            onBroadcastStreamChange(broadcastStreamRef.current);
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
    stopBroadcast,
    videoRef,
    overlayCanvasRef,
    settingsStore,
    resultStore,
  ]);
}
