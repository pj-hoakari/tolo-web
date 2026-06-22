import { type RefObject, useEffect } from "react";
import type {
  DetectionLineCount,
  DetectionMetrics,
  DetectionSettings,
} from "../hooks/useCrowdDetectionLoop";
import type { DetectCrowdStatus } from "../hooks/useDetectCrowd";
import type { VideoSourceDescriptor } from "../utils/videoSource";

const STATUS_LABELS: Record<DetectCrowdStatus, string> = {
  idle: "停止中",
  loading: "起動中",
  detecting: "検出中",
  error: "エラー",
};

export type CrowdDetectionViewProps = {
  videoSource: VideoSourceDescriptor | null;
  status: DetectCrowdStatus;
  error: string | null;
  lineCount: DetectionLineCount;
  metrics: DetectionMetrics;
  settings: DetectionSettings;
  onSettingsChange: (settings: DetectionSettings) => void;
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
};

export function CrowdDetectionView({
  videoSource,
  status,
  error,
  lineCount,
  metrics,
  settings,
  onSettingsChange,
  videoRef,
  overlayCanvasRef,
}: CrowdDetectionViewProps) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (!videoSource) {
      video.srcObject = null;
      video.removeAttribute("src");
      video.loop = false;
      video.load();
      return;
    }

    if (videoSource.kind === "stream") {
      video.removeAttribute("src");
      video.loop = false;
      video.srcObject = videoSource.stream;
    } else {
      video.srcObject = null;
      video.loop = videoSource.loop;
      video.src = videoSource.url;
    }
  }, [videoSource, videoRef]);

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="relative w-full max-w-3xl">
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
              onSettingsChange({
                ...settings,
                confidenceThreshold: Number(event.target.value),
              })
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
              onSettingsChange({
                ...settings,
                trackingDistanceThreshold: Number(event.target.value),
              })
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
              onSettingsChange({
                ...settings,
                detectionInterval: Number(event.target.value),
              })
            }
          />
        </label>
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.showBoundingBoxes}
              onChange={(event) =>
                onSettingsChange({
                  ...settings,
                  showBoundingBoxes: event.target.checked,
                })
              }
            />
            bounding box を表示
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.showTrackingIds}
              onChange={(event) =>
                onSettingsChange({
                  ...settings,
                  showTrackingIds: event.target.checked,
                })
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
