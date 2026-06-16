"use client";

import { useEffect, useRef, useState } from "react";
import type { DetectCrowdStatus } from "../hooks/useDetectCrowd";
import { detectCrowdFrame, type TrackedDetection } from "../utils/detectCrowd";

type DetectionMetrics = {
  detectedCount: number;
  trackedCount: number;
  totalTrackedCount: number;
  fps: number;
  lastDetectedAt: Date | null;
  detections: TrackedDetection[];
};

type DetectionSettings = {
  confidenceThreshold: number;
  trackingDistanceThreshold: number;
  detectionInterval: number;
  showBoundingBoxes: boolean;
  showTrackingIds: boolean;
};

const INITIAL_METRICS: DetectionMetrics = {
  detectedCount: 0,
  trackedCount: 0,
  totalTrackedCount: 0,
  fps: 0,
  lastDetectedAt: null,
  detections: [],
};

const INITIAL_SETTINGS: DetectionSettings = {
  confidenceThreshold: 0.15,
  trackingDistanceThreshold: 0.8,
  detectionInterval: 100,
  showBoundingBoxes: true,
  showTrackingIds: true,
};

const STATUS_LABELS: Record<DetectCrowdStatus, string> = {
  idle: "停止中",
  loading: "起動中",
  detecting: "検出中",
  error: "エラー",
};

export type CrowdDetectionViewProps = {
  stream: MediaStream | null;
  status: DetectCrowdStatus;
  error: string | null;
  onDetectionError: (cause: unknown) => void;
};

export function CrowdDetectionView({
  stream,
  status,
  error,
  onDetectionError,
}: CrowdDetectionViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lineCount, setLineCount] = useState({ forward: 0, backward: 0 });
  const [metrics, setMetrics] = useState<DetectionMetrics>(INITIAL_METRICS);
  const [settings, setSettings] = useState<DetectionSettings>(INITIAL_SETTINGS);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (status !== "detecting") {
      const canvas = canvasRef.current;
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      setLineCount({ forward: 0, backward: 0 });
      setMetrics(INITIAL_METRICS);
      return;
    }

    let animationFrameId = 0;
    let timeoutId = 0;
    let cancelled = false;
    let previousFrameAt = performance.now();

    const detectFrame = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (
        !video ||
        !canvas ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        animationFrameId = requestAnimationFrame(detectFrame);
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

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("検出結果を描画する canvas を初期化できませんでした");
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.lineWidth = Math.max(2, canvas.width / 320);
        context.font = `${Math.max(16, canvas.width / 40)}px sans-serif`;
        context.strokeStyle = "#f59e0b";
        context.setLineDash([12, 8]);
        context.beginPath();
        context.moveTo(frame.countingLine.p1.x, frame.countingLine.p1.y);
        context.lineTo(frame.countingLine.p2.x, frame.countingLine.p2.y);
        context.stroke();
        context.setLineDash([]);

        for (const detection of frame.detections) {
          const width = detection.x2 - detection.x1;
          const height = detection.y2 - detection.y1;
          const label = currentSettings.showTrackingIds
            ? `Person #${detection.trackId} ${Math.round(detection.score * 100)}%`
            : `${Math.round(detection.score * 100)}%`;

          if (currentSettings.showBoundingBoxes) {
            context.strokeStyle = "#22c55e";
            context.strokeRect(detection.x1, detection.y1, width, height);
          }

          if (
            currentSettings.showBoundingBoxes ||
            currentSettings.showTrackingIds
          ) {
            const labelWidth = context.measureText(label).width + 12;
            const labelHeight = Math.max(22, canvas.width / 32);
            const labelY = Math.max(0, detection.y1 - labelHeight);
            context.fillStyle = "#22c55e";
            context.fillRect(detection.x1, labelY, labelWidth, labelHeight);
            context.fillStyle = "#052e16";
            context.fillText(label, detection.x1 + 6, labelY + labelHeight - 6);
          }
        }

        setLineCount((current) =>
          current.forward === frame.lineCount.forward &&
          current.backward === frame.lineCount.backward
            ? current
            : frame.lineCount,
        );
        const frameAt = performance.now();
        const fps = 1000 / Math.max(1, frameAt - previousFrameAt);
        previousFrameAt = frameAt;
        setMetrics((current) => ({
          detectedCount: frame.detectedCount,
          trackedCount: frame.detections.length,
          totalTrackedCount: frame.totalTrackedCount,
          fps,
          lastDetectedAt:
            frame.detectedCount > 0 ? new Date() : current.lastDetectedAt,
          detections: frame.detections,
        }));

        timeoutId = window.setTimeout(() => {
          animationFrameId = requestAnimationFrame(detectFrame);
        }, settingsRef.current.detectionInterval);
      } catch (cause) {
        if (!cancelled) {
          onDetectionError(cause);
        }
      }
    };

    animationFrameId = requestAnimationFrame(detectFrame);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      cancelAnimationFrame(animationFrameId);
    };
  }, [status, onDetectionError]);

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="relative w-full max-w-3xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="aspect-video w-full rounded bg-black"
        >
          <track kind="captions" />
        </video>
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full rounded"
        />
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center rounded bg-black/40 text-white">
            起動中…
          </div>
        )}
      </div>
      <div className="flex gap-6 text-sm">
        <span>ライン通過 forward: {lineCount.forward}</span>
        <span>ライン通過 backward: {lineCount.backward}</span>
      </div>
      <section className="grid w-full max-w-3xl gap-4 rounded border border-gray-200 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <p>検出状態: {STATUS_LABELS[status]}</p>
        <p>検出人数: {metrics.detectedCount}人</p>
        <p>追跡中人数: {metrics.trackedCount}人</p>
        <p>累計 tracking ID: {metrics.totalTrackedCount}</p>
        <p>FPS: {metrics.fps.toFixed(1)}</p>
        <p>
          最終検出時刻: {metrics.lastDetectedAt?.toLocaleTimeString() ?? "-"}
        </p>
      </section>
      <section className="w-full max-w-3xl rounded border border-gray-200 p-4">
        <h3 className="mb-2 font-bold">検出結果一覧</h3>
        {metrics.detections.length === 0 ? (
          <p className="text-gray-500 text-sm">検出結果はありません</p>
        ) : (
          <ul className="space-y-1 font-mono text-xs">
            {metrics.detections.map((detection) => (
              <li key={detection.trackId}>
                ID: {detection.trackId} / confidence:{" "}
                {detection.score.toFixed(2)}
                {" / "}x: {Math.round(detection.x1)} / y:{" "}
                {Math.round(detection.y1)} / w:{" "}
                {Math.round(detection.x2 - detection.x1)} / h:{" "}
                {Math.round(detection.y2 - detection.y1)}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="grid w-full max-w-3xl gap-4 rounded border border-gray-200 p-4 sm:grid-cols-2">
        <h3 className="font-bold sm:col-span-2">検出設定</h3>
        <label className="flex flex-col gap-1 text-sm">
          <span>
            confidence threshold: {settings.confidenceThreshold.toFixed(2)}
          </span>
          <input
            type="range"
            min="0.05"
            max="1"
            step="0.05"
            value={settings.confidenceThreshold}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                confidenceThreshold: Number(event.target.value),
              }))
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>
            tracking distance threshold:{" "}
            {settings.trackingDistanceThreshold.toFixed(2)}
          </span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={settings.trackingDistanceThreshold}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                trackingDistanceThreshold: Number(event.target.value),
              }))
            }
          />
          <small className="text-gray-500">
            高いほど緩い IoU distance 判定
          </small>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>検出間隔: {settings.detectionInterval}ms</span>
          <input
            type="range"
            min="0"
            max="1000"
            step="50"
            value={settings.detectionInterval}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                detectionInterval: Number(event.target.value),
              }))
            }
          />
        </label>
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.showBoundingBoxes}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  showBoundingBoxes: event.target.checked,
                }))
              }
            />
            bounding box を表示
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.showTrackingIds}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  showTrackingIds: event.target.checked,
                }))
              }
            />
            tracking ID を表示
          </label>
        </div>
      </section>
      {status === "error" && error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
