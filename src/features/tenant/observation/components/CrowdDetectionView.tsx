import { type PointerEvent, type RefObject, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  DetectionLineCount,
  DetectionMetrics,
  DetectionPoint,
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

type LineDragTarget = "p1" | "p2" | "line";
type DragTargetDetection = {
  target: LineDragTarget;
  snapToPointer: boolean;
};

const DEFAULT_COUNTING_LINE = {
  p1: { x: 0, y: 0.6 },
  p2: { x: 1, y: 0.6 },
};
const LINE_HIT_RADIUS_PX = 18;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function distance(a: DetectionPoint, b: DetectionPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(
  point: DetectionPoint,
  start: DetectionPoint,
  end: DetectionPoint,
): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (lengthSquared === 0) {
    return distance(point, start);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) /
        lengthSquared,
    ),
  );
  return distance(point, {
    x: start.x + t * segmentX,
    y: start.y + t * segmentY,
  });
}

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
  const dragStateRef = useRef<{
    target: LineDragTarget;
    pointerId: number;
    startPoint: DetectionPoint;
    startLine: DetectionSettings["countingLine"];
  } | null>(null);

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

  const getPointerPoint = (
    event: PointerEvent<HTMLCanvasElement>,
  ): DetectionPoint | null => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const getAbsoluteLine = (
    canvas: HTMLCanvasElement,
  ): { p1: DetectionPoint; p2: DetectionPoint } => ({
    p1: {
      x: settings.countingLine.p1.x * canvas.width,
      y: settings.countingLine.p1.y * canvas.height,
    },
    p2: {
      x: settings.countingLine.p2.x * canvas.width,
      y: settings.countingLine.p2.y * canvas.height,
    },
  });

  const detectDragTarget = (
    point: DetectionPoint,
    canvas: HTMLCanvasElement,
  ): DragTargetDetection => {
    const line = getAbsoluteLine(canvas);

    if (distance(point, line.p1) <= LINE_HIT_RADIUS_PX) {
      return { target: "p1", snapToPointer: false };
    }
    if (distance(point, line.p2) <= LINE_HIT_RADIUS_PX) {
      return { target: "p2", snapToPointer: false };
    }
    return distanceToSegment(point, line.p1, line.p2) <= LINE_HIT_RADIUS_PX
      ? { target: "line", snapToPointer: false }
      : { target: "p2", snapToPointer: true };
  };

  const applyCountingLine = (
    countingLine: DetectionSettings["countingLine"],
  ) => {
    onSettingsChange({
      ...settings,
      countingLine: {
        p1: {
          x: clampUnit(countingLine.p1.x),
          y: clampUnit(countingLine.p1.y),
        },
        p2: {
          x: clampUnit(countingLine.p2.x),
          y: clampUnit(countingLine.p2.y),
        },
      },
    });
  };

  const handleLinePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    const point = getPointerPoint(event);
    if (!canvas || !point) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const dragTarget = detectDragTarget(point, canvas);
    const startLine =
      dragTarget.snapToPointer && dragTarget.target !== "line"
        ? {
            ...settings.countingLine,
            [dragTarget.target]: {
              x: point.x / canvas.width,
              y: point.y / canvas.height,
            },
          }
        : settings.countingLine;

    if (dragTarget.snapToPointer) {
      applyCountingLine(startLine);
    }

    dragStateRef.current = {
      target: dragTarget.target,
      pointerId: event.pointerId,
      startPoint: point,
      startLine,
    };
  };

  const handleLinePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const dragState = dragStateRef.current;
    const canvas = overlayCanvasRef.current;
    const point = getPointerPoint(event);
    if (!dragState || !canvas || !point) {
      return;
    }

    const dx = (point.x - dragState.startPoint.x) / canvas.width;
    const dy = (point.y - dragState.startPoint.y) / canvas.height;
    const nextLine =
      dragState.target === "line"
        ? {
            p1: {
              x: dragState.startLine.p1.x + dx,
              y: dragState.startLine.p1.y + dy,
            },
            p2: {
              x: dragState.startLine.p2.x + dx,
              y: dragState.startLine.p2.y + dy,
            },
          }
        : {
            ...dragState.startLine,
            [dragState.target]: {
              x:
                dragState.startLine[dragState.target].x +
                (point.x - dragState.startPoint.x) / canvas.width,
              y:
                dragState.startLine[dragState.target].y +
                (point.y - dragState.startPoint.y) / canvas.height,
            },
          };

    applyCountingLine(nextLine);
  };

  const handleLinePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
    }
  };

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
          onPointerDown={handleLinePointerDown}
          onPointerMove={handleLinePointerMove}
          onPointerUp={handleLinePointerUp}
          onPointerCancel={handleLinePointerUp}
          className="absolute inset-0 h-full w-full touch-none rounded cursor-crosshair"
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
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <h3 className="font-bold">検出設定</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onPress={() =>
              onSettingsChange({
                ...settings,
                countingLine: DEFAULT_COUNTING_LINE,
              })
            }
          >
            ラインを初期位置に戻す
          </Button>
        </div>
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
          <Checkbox
            isSelected={settings.showBoundingBoxes}
            onChange={(showBoundingBoxes) =>
              onSettingsChange({
                ...settings,
                showBoundingBoxes,
              })
            }
          >
            bounding box を表示
          </Checkbox>
          <Checkbox
            isSelected={settings.showTrackingIds}
            onChange={(showTrackingIds) =>
              onSettingsChange({
                ...settings,
                showTrackingIds,
              })
            }
          >
            tracking ID を表示
          </Checkbox>
        </div>
      </section>
      {status === "error" && error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
