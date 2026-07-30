import { type PointerEvent, type RefObject, useCallback, useRef } from "react";
import {
  applyCountingLines,
  type DetectionCountingLineSetting,
  type DetectionPoint,
  type DetectionSettingsStore,
  type DetectionViewStateStore,
  selectLine,
} from "../stores/detectionStore";

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

const LINE_HIT_RADIUS_PX = 18;
const MIN_CREATED_LINE_LENGTH_PX = 8;

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

function getAbsoluteLine(
  line: DetectionCountingLineSetting,
  canvas: HTMLCanvasElement,
): { p1: DetectionPoint; p2: DetectionPoint } {
  return {
    p1: { x: line.p1.x * canvas.width, y: line.p1.y * canvas.height },
    p2: { x: line.p2.x * canvas.width, y: line.p2.y * canvas.height },
  };
}

function detectDragTarget(
  countingLines: DetectionCountingLineSetting[],
  point: DetectionPoint,
  canvas: HTMLCanvasElement,
): { lineId: string; target: LineDragTarget } | null {
  for (const lineSetting of [...countingLines].reverse()) {
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
}

export function createLineId(
  countingLines: DetectionCountingLineSetting[],
): string {
  const nextNumber =
    Math.max(
      0,
      ...countingLines.map((line) => {
        const match = /^line-(\d+)$/.exec(line.id);
        return match ? Number(match[1]) : 0;
      }),
    ) + 1;
  return `line-${nextNumber}`;
}

export type CountingLineEditorHandlers = {
  onPointerDown: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLCanvasElement>) => void;
};

export type UseCountingLineEditorParams = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** null のときは編集を受け付けない（閲覧のみの表示で使う） */
  settingsStore: DetectionSettingsStore | null;
  viewStateStore: DetectionViewStateStore | null;
};

/**
 * カウントラインをオーバーレイ上のドラッグで編集する
 *
 * 座標は canvas のピクセル空間で扱い，ストアには 0〜1 の相対値で書き戻す。
 * ドラッグ中の更新はストアの getState / setState だけで完結させ，
 * 再レンダリングを挟まない。
 */
export function useCountingLineEditor({
  canvasRef,
  settingsStore,
  viewStateStore,
}: UseCountingLineEditorParams): CountingLineEditorHandlers {
  const dragStateRef = useRef<DragState | null>(null);

  const getPointerPoint = useCallback(
    (event: PointerEvent<HTMLCanvasElement>): DetectionPoint | null => {
      const canvas = canvasRef.current;
      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        return null;
      }

      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * canvas.width,
        y: ((event.clientY - rect.top) / rect.height) * canvas.height,
      };
    },
    [canvasRef],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const point = getPointerPoint(event);
      if (!settingsStore || !viewStateStore || !canvas || !point) {
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      const countingLines = settingsStore.getState().countingLines;
      const unitPoint = {
        x: point.x / canvas.width,
        y: point.y / canvas.height,
      };

      if (viewStateStore.getState().lineCreationMode) {
        const lineId = createLineId(countingLines);
        const nextLines = [
          ...countingLines,
          { id: lineId, p1: unitPoint, p2: unitPoint },
        ];
        selectLine(viewStateStore, lineId);
        applyCountingLines(settingsStore, nextLines);
        dragStateRef.current = {
          kind: "create",
          lineId,
          pointerId: event.pointerId,
          startPoint: point,
          startLines: nextLines,
        };
        return;
      }

      const dragTarget = detectDragTarget(countingLines, point, canvas);
      if (!dragTarget) {
        return;
      }

      selectLine(viewStateStore, dragTarget.lineId);
      dragStateRef.current = {
        kind: "edit",
        lineId: dragTarget.lineId,
        target: dragTarget.target,
        pointerId: event.pointerId,
        startPoint: point,
        startLines: countingLines,
      };
    },
    [canvasRef, getPointerPoint, settingsStore, viewStateStore],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const dragState = dragStateRef.current;
      const canvas = canvasRef.current;
      const point = getPointerPoint(event);
      if (!settingsStore || !dragState || !canvas || !point) {
        return;
      }

      const dx = (point.x - dragState.startPoint.x) / canvas.width;
      const dy = (point.y - dragState.startPoint.y) / canvas.height;

      if (dragState.kind === "create") {
        applyCountingLines(
          settingsStore,
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
        settingsStore,
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
    },
    [canvasRef, getPointerPoint, settingsStore],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const dragState = dragStateRef.current;
      const canvas = canvasRef.current;
      const point = getPointerPoint(event);
      if (!settingsStore || dragState?.pointerId !== event.pointerId) {
        return;
      }

      if (
        dragState.kind === "create" &&
        canvas &&
        point &&
        distance(dragState.startPoint, point) < MIN_CREATED_LINE_LENGTH_PX
      ) {
        applyCountingLines(
          settingsStore,
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
    },
    [canvasRef, getPointerPoint, settingsStore],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  };
}
