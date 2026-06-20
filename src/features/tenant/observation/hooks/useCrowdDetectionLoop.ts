import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type CrowdDetectionFrame,
  detectCrowdFrame,
  type TrackedDetection,
} from "../utils/detectCrowd";
import type { DetectCrowdStatus } from "./useDetectCrowd";

export type DetectionMetrics = {
  detectedCount: number;
  trackedCount: number;
  totalTrackedCount: number;
  fps: number;
  lastDetectedAt: Date | null;
  detections: TrackedDetection[];
};

export type DetectionSettings = {
  confidenceThreshold: number;
  trackingDistanceThreshold: number;
  detectionInterval: number;
  showBoundingBoxes: boolean;
  showTrackingIds: boolean;
};

export type DetectionLineCount = {
  forward: number;
  backward: number;
};

export const INITIAL_METRICS: DetectionMetrics = {
  detectedCount: 0,
  trackedCount: 0,
  totalTrackedCount: 0,
  fps: 0,
  lastDetectedAt: null,
  detections: [],
};

export const INITIAL_SETTINGS: DetectionSettings = {
  confidenceThreshold: 0.15,
  trackingDistanceThreshold: 0.8,
  detectionInterval: 100,
  showBoundingBoxes: true,
  showTrackingIds: true,
};

const INITIAL_LINE_COUNT: DetectionLineCount = { forward: 0, backward: 0 };

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

function drawDetectionOverlay(
  context: CanvasRenderingContext2D,
  frame: CrowdDetectionFrame,
  settings: Pick<DetectionSettings, "showBoundingBoxes" | "showTrackingIds">,
  width: number,
): void {
  context.lineWidth = Math.max(2, width / 320);
  context.font = `${Math.max(16, width / 40)}px sans-serif`;
  context.strokeStyle = "#f59e0b";
  context.setLineDash([12, 8]);
  context.beginPath();
  context.moveTo(frame.countingLine.p1.x, frame.countingLine.p1.y);
  context.lineTo(frame.countingLine.p2.x, frame.countingLine.p2.y);
  context.stroke();
  context.setLineDash([]);

  for (const detection of frame.detections) {
    const boxWidth = detection.x2 - detection.x1;
    const boxHeight = detection.y2 - detection.y1;
    const label = settings.showTrackingIds
      ? `Person #${detection.trackId} ${Math.round(detection.score * 100)}%`
      : `${Math.round(detection.score * 100)}%`;

    if (settings.showBoundingBoxes) {
      context.strokeStyle = "#22c55e";
      context.strokeRect(detection.x1, detection.y1, boxWidth, boxHeight);
    }

    if (settings.showBoundingBoxes || settings.showTrackingIds) {
      const labelWidth = context.measureText(label).width + 12;
      const labelHeight = Math.max(22, width / 32);
      const labelY = Math.max(0, detection.y1 - labelHeight);
      context.fillStyle = "#22c55e";
      context.fillRect(detection.x1, labelY, labelWidth, labelHeight);
      context.fillStyle = "#052e16";
      context.fillText(label, detection.x1 + 6, labelY + labelHeight - 6);
    }
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
  lineCount: DetectionLineCount;
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
  const [lineCount, setLineCount] =
    useState<DetectionLineCount>(INITIAL_LINE_COUNT);
  const [metrics, setMetrics] = useState<DetectionMetrics>(INITIAL_METRICS);

  useEffect(() => {
    settingsRef.current = settings;
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
      setLineCount(INITIAL_LINE_COUNT);
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
        const frame = await detectCrowdFrame(video, {
          confidenceThreshold: currentSettings.confidenceThreshold,
          trackingDistanceThreshold: currentSettings.trackingDistanceThreshold,
        });

        if (cancelled) {
          return;
        }

        latestFrameRef.current = frame;

        setLineCount((current) =>
          current.forward === frame.lineCount.forward &&
          current.backward === frame.lineCount.backward
            ? current
            : frame.lineCount,
        );
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
          detections: frame.detections,
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

        const overlay = overlayCanvasRef.current;
        if (overlay) {
          syncCanvasSize(overlay, width, height);
          const context = overlay.getContext("2d");
          if (context) {
            context.clearRect(0, 0, width, height);
            if (frame) {
              drawDetectionOverlay(context, frame, currentSettings, width);
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
            drawDetectionOverlay(
              broadcastContext,
              frame,
              currentSettings,
              width,
            );
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

  return { lineCount, metrics };
}
