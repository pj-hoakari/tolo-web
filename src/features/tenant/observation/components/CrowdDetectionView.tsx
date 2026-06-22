import { MousePointer2, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  type PointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { Input, TextField } from "@/components/ui/textfield";
import type {
  DetectionCountingLineSetting,
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
type DragState =
  | {
      kind: "edit";
      lineId: string;
      target: LineDragTarget;
      pointerId: number;
      startPoint: DetectionPoint;
      startLines: DetectionCountingLineSetting[];
    }
  | {
      kind: "create";
      lineId: string;
      pointerId: number;
      startPoint: DetectionPoint;
      startLines: DetectionCountingLineSetting[];
    };

const DEFAULT_COUNTING_LINES: DetectionCountingLineSetting[] = [
  {
    id: "line-1",
    p1: { x: 0, y: 0.6 },
    p2: { x: 1, y: 0.6 },
  },
];
const LINE_HIT_RADIUS_PX = 18;
const MIN_CREATED_LINE_LENGTH_PX = 8;

type NumberSettingKey =
  | "confidenceThreshold"
  | "trackingDistanceThreshold"
  | "detectionInterval";

type NumberSettingPreset = {
  label: string;
  value: number;
};

const CONFIDENCE_PRESETS: NumberSettingPreset[] = [
  { label: "広め", value: 0.1 },
  { label: "標準", value: 0.15 },
  { label: "厳しめ", value: 0.3 },
];

const TRACKING_PRESETS: NumberSettingPreset[] = [
  { label: "安定", value: 0.6 },
  { label: "標準", value: 0.8 },
  { label: "追従優先", value: 0.95 },
];

const DETECTION_INTERVAL_PRESETS: NumberSettingPreset[] = [
  { label: "高頻度", value: 50 },
  { label: "標準", value: 100 },
  { label: "省負荷", value: 250 },
];

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isSameNumberSetting(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

function clampNumberSetting(key: NumberSettingKey, value: number): number {
  if (!Number.isFinite(value)) {
    return key === "detectionInterval" ? 100 : 0.15;
  }

  switch (key) {
    case "confidenceThreshold":
      return Math.min(1, Math.max(0.05, value));
    case "trackingDistanceThreshold":
      return Math.min(1, Math.max(0.1, value));
    case "detectionInterval":
      return Math.min(1000, Math.max(0, Math.round(value)));
  }
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
  lineCounts: Record<string, DetectionLineCount>;
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
  lineCounts,
  metrics,
  settings,
  onSettingsChange,
  videoRef,
  overlayCanvasRef,
}: CrowdDetectionViewProps) {
  const dragStateRef = useRef<DragState | null>(null);
  const [lineCreationMode, setLineCreationMode] = useState(false);
  const [fineTuningOpen, setFineTuningOpen] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState(
    settings.countingLines[0]?.id ?? "line-1",
  );

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

  useEffect(() => {
    if (!settings.countingLines.some((line) => line.id === selectedLineId)) {
      setSelectedLineId(settings.countingLines[0]?.id ?? "line-1");
    }
  }, [selectedLineId, settings.countingLines]);

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
    line: DetectionCountingLineSetting,
    canvas: HTMLCanvasElement,
  ): { p1: DetectionPoint; p2: DetectionPoint } => ({
    p1: {
      x: line.p1.x * canvas.width,
      y: line.p1.y * canvas.height,
    },
    p2: {
      x: line.p2.x * canvas.width,
      y: line.p2.y * canvas.height,
    },
  });

  const detectDragTarget = (
    point: DetectionPoint,
    canvas: HTMLCanvasElement,
  ): { lineId: string; target: LineDragTarget } | null => {
    for (const lineSetting of [...settings.countingLines].reverse()) {
      const line = getAbsoluteLine(lineSetting, canvas);

      if (distance(point, line.p1) <= LINE_HIT_RADIUS_PX) {
        return { lineId: lineSetting.id, target: "p1" };
      }
      if (distance(point, line.p2) <= LINE_HIT_RADIUS_PX) {
        return { lineId: lineSetting.id, target: "p2" };
      }
      if (distanceToSegment(point, line.p1, line.p2) <= LINE_HIT_RADIUS_PX) {
        return { lineId: lineSetting.id, target: "line" };
      }
    }

    return null;
  };

  const applyCountingLines = (
    countingLines: DetectionCountingLineSetting[],
  ) => {
    onSettingsChange({
      ...settings,
      countingLines: countingLines.map((line) => ({
        ...line,
        p1: {
          x: clampUnit(line.p1.x),
          y: clampUnit(line.p1.y),
        },
        p2: {
          x: clampUnit(line.p2.x),
          y: clampUnit(line.p2.y),
        },
      })),
    });
  };

  const createLineId = () => {
    const nextNumber =
      Math.max(
        0,
        ...settings.countingLines.map((line) => {
          const match = /^line-(\d+)$/.exec(line.id);
          return match ? Number(match[1]) : 0;
        }),
      ) + 1;
    return `line-${nextNumber}`;
  };

  const handleLinePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    const point = getPointerPoint(event);
    if (!canvas || !point) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const unitPoint = {
      x: point.x / canvas.width,
      y: point.y / canvas.height,
    };

    if (lineCreationMode) {
      const lineId = createLineId();
      const nextLines = [
        ...settings.countingLines,
        { id: lineId, p1: unitPoint, p2: unitPoint },
      ];
      setSelectedLineId(lineId);
      applyCountingLines(nextLines);
      dragStateRef.current = {
        kind: "create",
        lineId,
        pointerId: event.pointerId,
        startPoint: point,
        startLines: nextLines,
      };
      return;
    }

    const dragTarget = detectDragTarget(point, canvas);
    if (!dragTarget) {
      return;
    }

    setSelectedLineId(dragTarget.lineId);
    dragStateRef.current = {
      kind: "edit",
      lineId: dragTarget.lineId,
      target: dragTarget.target,
      pointerId: event.pointerId,
      startPoint: point,
      startLines: settings.countingLines,
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

    if (dragState.kind === "create") {
      applyCountingLines(
        dragState.startLines.map((line) =>
          line.id === dragState.lineId
            ? {
                ...line,
                p2: {
                  x: line.p1.x + dx,
                  y: line.p1.y + dy,
                },
              }
            : line,
        ),
      );
      return;
    }

    applyCountingLines(
      dragState.startLines.map((line) => {
        if (line.id !== dragState.lineId) {
          return line;
        }

        if (dragState.target === "line") {
          return {
            ...line,
            p1: {
              x: line.p1.x + dx,
              y: line.p1.y + dy,
            },
            p2: {
              x: line.p2.x + dx,
              y: line.p2.y + dy,
            },
          };
        }

        return {
          ...line,
          [dragState.target]: {
            x: line[dragState.target].x + dx,
            y: line[dragState.target].y + dy,
          },
        };
      }),
    );
  };

  const handleLinePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const dragState = dragStateRef.current;
    const canvas = overlayCanvasRef.current;
    const point = getPointerPoint(event);
    if (dragState?.pointerId !== event.pointerId) {
      return;
    }

    if (
      dragState.kind === "create" &&
      canvas &&
      point &&
      distance(dragState.startPoint, point) < MIN_CREATED_LINE_LENGTH_PX
    ) {
      applyCountingLines(
        dragState.startLines.map((line) =>
          line.id === dragState.lineId
            ? {
                ...line,
                p2: {
                  x: line.p1.x + 0.25,
                  y: line.p1.y,
                },
              }
            : line,
        ),
      );
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    dragStateRef.current = null;
  };

  const resetCountingLines = () => {
    setSelectedLineId(DEFAULT_COUNTING_LINES[0].id);
    applyCountingLines(DEFAULT_COUNTING_LINES);
  };

  const deleteSelectedLine = () => {
    if (settings.countingLines.length <= 1) {
      return;
    }
    const nextLines = settings.countingLines.filter(
      (line) => line.id !== selectedLineId,
    );
    setSelectedLineId(nextLines[0]?.id ?? "line-1");
    applyCountingLines(nextLines);
  };

  const setNumberSetting = (key: NumberSettingKey, value: number) => {
    onSettingsChange({
      ...settings,
      [key]: clampNumberSetting(key, value),
    });
  };

  const renderPresetGroup = ({
    title,
    value,
    presets,
    settingKey,
    valueLabel,
  }: {
    title: string;
    value: number;
    presets: NumberSettingPreset[];
    settingKey: NumberSettingKey;
    valueLabel: string;
  }) => (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{title}</span>
        <span className="text-gray-500">{valueLabel}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={`${settingKey}-${preset.value}`}
            type="button"
            variant={
              isSameNumberSetting(value, preset.value) ? "default" : "outline"
            }
            size="sm"
            onPress={() => setNumberSetting(settingKey, preset.value)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  );

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
      <div className="flex w-full max-w-3xl flex-wrap gap-3 text-sm">
        {settings.countingLines.map((line, index) => {
          const count = lineCounts[line.id] ?? { forward: 0, backward: 0 };
          return (
            <Button
              type="button"
              key={line.id}
              variant={selectedLineId === line.id ? "default" : "outline"}
              size="sm"
              onPress={() => setSelectedLineId(line.id)}
            >
              ライン {index + 1}: forward {count.forward} / backward{" "}
              {count.backward}
            </Button>
          );
        })}
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
      <section className="grid w-full max-w-3xl gap-4 rounded border border-gray-200 p-4 sm:grid-cols-2">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <h3 className="font-bold">検出設定</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={lineCreationMode ? "default" : "outline"}
              size="sm"
              onPress={() => setLineCreationMode((enabled) => !enabled)}
            >
              {lineCreationMode ? (
                <MousePointer2 className="mr-2 size-4" />
              ) : (
                <Plus className="mr-2 size-4" />
              )}
              {lineCreationMode ? "編集モード" : "ライン生成"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onPress={deleteSelectedLine}
              isDisabled={settings.countingLines.length <= 1}
            >
              <Trash2 className="mr-2 size-4" />
              選択ラインを削除
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onPress={resetCountingLines}
            >
              <RotateCcw className="mr-2 size-4" />
              ラインを初期位置に戻す
            </Button>
          </div>
        </div>
        {renderPresetGroup({
          title: "検出感度",
          value: settings.confidenceThreshold,
          presets: CONFIDENCE_PRESETS,
          settingKey: "confidenceThreshold",
          valueLabel: settings.confidenceThreshold.toFixed(2),
        })}
        {renderPresetGroup({
          title: "追跡のつながりやすさ",
          value: settings.trackingDistanceThreshold,
          presets: TRACKING_PRESETS,
          settingKey: "trackingDistanceThreshold",
          valueLabel: settings.trackingDistanceThreshold.toFixed(2),
        })}
        {renderPresetGroup({
          title: "検出頻度",
          value: settings.detectionInterval,
          presets: DETECTION_INTERVAL_PRESETS,
          settingKey: "detectionInterval",
          valueLabel: `${settings.detectionInterval}ms`,
        })}
        <div className="sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onPress={() => setFineTuningOpen((open) => !open)}
          >
            {fineTuningOpen ? "詳細調整を閉じる" : "詳細調整"}
          </Button>
        </div>
        {fineTuningOpen && (
          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
            <TextField className="flex flex-col gap-2">
              <Label>検出感度</Label>
              <Input
                type="number"
                min={0.05}
                max={1}
                step={0.01}
                value={settings.confidenceThreshold}
                onChange={(event) =>
                  setNumberSetting(
                    "confidenceThreshold",
                    Number(event.currentTarget.value),
                  )
                }
              />
            </TextField>
            <TextField className="flex flex-col gap-2">
              <Label>追跡のつながりやすさ</Label>
              <Input
                type="number"
                min={0.1}
                max={1}
                step={0.01}
                value={settings.trackingDistanceThreshold}
                onChange={(event) =>
                  setNumberSetting(
                    "trackingDistanceThreshold",
                    Number(event.currentTarget.value),
                  )
                }
              />
            </TextField>
            <TextField className="flex flex-col gap-2">
              <Label>検出間隔 ms</Label>
              <Input
                type="number"
                min={0}
                max={1000}
                step={10}
                value={settings.detectionInterval}
                onChange={(event) =>
                  setNumberSetting(
                    "detectionInterval",
                    Number(event.currentTarget.value),
                  )
                }
              />
            </TextField>
          </div>
        )}
      </section>
      {status === "error" && error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
