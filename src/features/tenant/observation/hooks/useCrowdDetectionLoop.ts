import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type CrowdCountingLine,
  type CrowdDetectionFrame,
  detectCrowdFrame,
  resetCrowdLineCount,
} from "../utils/detectCrowd";
import type { DetectCrowdStatus } from "./useDetectCrowd";

export type DetectionMetrics = {
  detectedCount: number;
  trackedCount: number;
  totalTrackedCount: number;
  fps: number;
  lastDetectedAt: Date | null;
};

export type DetectionSettings = {
  confidenceThreshold: number;
  trackingDistanceThreshold: number;
  detectionInterval: number;
  countingLines: DetectionCountingLineSetting[];
};

export type DetectionLineCount = {
  forward: number;
  backward: number;
};

export type DetectionPoint = {
  x: number;
  y: number;
};

export type DetectionCountingLineSetting = {
  id: string;
  p1: DetectionPoint;
  p2: DetectionPoint;
};

export const INITIAL_METRICS: DetectionMetrics = {
  detectedCount: 0,
  trackedCount: 0,
  totalTrackedCount: 0,
  fps: 0,
  lastDetectedAt: null,
};

export const INITIAL_SETTINGS: DetectionSettings = {
  confidenceThreshold: 0.15,
  trackingDistanceThreshold: 0.8,
  detectionInterval: 100,
  countingLines: [
    {
      id: "line-1",
      p1: { x: 0, y: 0.6 },
      p2: { x: 1, y: 0.6 },
    },
  ],
};

const INITIAL_LINE_COUNT: DetectionLineCount = { forward: 0, backward: 0 };
const INITIAL_LINE_COUNTS: Record<string, DetectionLineCount> = {
  "line-1": INITIAL_LINE_COUNT,
};

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

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
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
  _frame: CrowdDetectionFrame,
  countingLines: CrowdCountingLine[],
  width: number,
): void {
  for (const countingLine of countingLines) {
    drawCountingLine(context, countingLine, width);
  }
}

export type UseCrowdDetectionLoopParams = {
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
  status: DetectCrowdStatus;
  settings: DetectionSettings;
  onBroadcastStreamChange: (stream: MediaStream | null) => void;
  onDetectionError: (cause: unknown) => void;
};

export type UseCrowdDetectionLoopResult = {
  lineCounts: Record<string, DetectionLineCount>;
  metrics: DetectionMetrics;
};

export function useCrowdDetectionLoop({
  videoRef,
  overlayCanvasRef,
  status,
  settings,
  onBroadcastStreamChange,
  onDetectionError,
}: UseCrowdDetectionLoopParams): UseCrowdDetectionLoopResult {
  const broadcastCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const broadcastStreamRef = useRef<MediaStream | null>(null);
  const latestFrameRef = useRef<CrowdDetectionFrame | null>(null);
  const settingsRef = useRef(settings);
  const previousCountingLinesRef = useRef(settings.countingLines);
  const [lineCounts, setLineCounts] =
    useState<Record<string, DetectionLineCount>>(INITIAL_LINE_COUNTS);
  const [metrics, setMetrics] = useState<DetectionMetrics>(INITIAL_METRICS);

  useEffect(() => {
    const previousCountingLines = previousCountingLinesRef.current;
    const nextCountingLines = settings.countingLines;
    settingsRef.current = settings;

    if (
      JSON.stringify(previousCountingLines) !==
      JSON.stringify(nextCountingLines)
    ) {
      latestFrameRef.current = null;
      resetCrowdLineCount();
      setLineCounts(
        Object.fromEntries(
          nextCountingLines.map((line) => [line.id, INITIAL_LINE_COUNT]),
        ),
      );
      previousCountingLinesRef.current = nextCountingLines;
    }
  }, [settings]);

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
      setLineCounts(
        Object.fromEntries(
          settingsRef.current.countingLines.map((line) => [
            line.id,
            INITIAL_LINE_COUNT,
          ]),
        ),
      );
      setMetrics(INITIAL_METRICS);
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
          settingsRef.current.detectionInterval,
        );
        return;
      }

      try {
        const currentSettings = settingsRef.current;
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

        setLineCounts((current) => {
          const next = frame.lineCounts;
          const currentJson = JSON.stringify(current);
          const nextJson = JSON.stringify(next);
          return currentJson === nextJson ? current : next;
        });
        const detectionAt = performance.now();
        const fps = 1000 / Math.max(1, detectionAt - previousDetectionAt);
        previousDetectionAt = detectionAt;
        setMetrics((current) => ({
          detectedCount: frame.detectedCount,
          trackedCount: frame.detections.length,
          totalTrackedCount: frame.totalTrackedCount,
          fps,
          lastDetectedAt:
            frame.detectedCount > 0 ? new Date() : current.lastDetectedAt,
        }));
      } catch (cause) {
        if (!cancelled) {
          onDetectionError(cause);
        }
        return;
      }

      detectTimeoutId = window.setTimeout(
        detectLoop,
        settingsRef.current.detectionInterval,
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
        const currentSettings = settingsRef.current;
        const countingLines = toCrowdCountingLines(
          currentSettings.countingLines,
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
  ]);

  return { lineCounts, metrics };
}
