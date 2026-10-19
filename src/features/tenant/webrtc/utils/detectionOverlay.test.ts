import { expect, it, vi } from "vitest";
import {
  type DetectionOverlayFrame,
  drawDetectionOverlay,
} from "./detectionOverlay";

it("未選択ラインを破線、選択中を実線で専用レイヤーに描く", () => {
  const strokes: unknown[] = [];
  const lineContext = {
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    setLineDash: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    strokeStyle: "",
    stroke() {
      strokes.push(this.strokeStyle);
    },
  };
  const lineCanvas = { width: 0, height: 0, getContext: () => lineContext };
  const context = { stroke: vi.fn() };
  const frame: DetectionOverlayFrame = {
    width: 640,
    height: 480,
    detections: [],
    lineCounts: {},
    countingLines: [
      { id: "a", name: "", p1: { x: 0, y: 0 }, p2: { x: 100, y: 100 } },
      { id: "b", name: "", p1: { x: 10, y: 0 }, p2: { x: 110, y: 100 } },
    ],
  };
  drawDetectionOverlay(context as unknown as CanvasRenderingContext2D, frame, {
    lineCanvas: lineCanvas as unknown as HTMLCanvasElement,
    highlightedLineId: "b",
  });
  expect(lineCanvas.width).toBe(640);
  expect(lineCanvas.height).toBe(480);
  expect(lineContext.clearRect).toHaveBeenCalledWith(0, 0, 640, 480);
  expect(strokes).toEqual(["#22d3ee", "#22d3ee", "#fbbf24", "#fbbf24"]);
  expect(lineContext.setLineDash.mock.calls).toEqual([
    [[12, 10]],
    [[]],
    [[]],
    [[]],
  ]);
  expect(context.stroke).not.toHaveBeenCalled();
});
