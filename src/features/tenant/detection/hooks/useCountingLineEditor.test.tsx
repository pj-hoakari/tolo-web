// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import type { PointerEvent } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  createDetectionStores,
  setLineCreationMode,
} from "../stores/detectionStore";
import { useCountingLineEditor } from "./useCountingLineEditor";

afterEach(cleanup);

function setup() {
  const stores = createDetectionStores();
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 1000;
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1000, height: 1000 }) as DOMRect;
  const { result } = renderHook(() =>
    useCountingLineEditor({ canvasRef: { current: canvas }, ...stores }),
  );
  const event = (x: number, y: number, type = "pointerup") =>
    ({
      clientX: x,
      clientY: y,
      pointerId: 1,
      currentTarget: canvas,
      type,
    }) as PointerEvent<HTMLCanvasElement>;
  const create = () => {
    act(() => {
      setLineCreationMode(stores.viewStateStore, true);
      result.current.onPointerDown(event(200, 200));
      result.current.onPointerMove(event(600, 200));
      result.current.onPointerUp(event(600, 200));
    });
  };
  return { ...stores, result, event, create };
}

it("生成後の微調整が終わると生成モードに戻り、続けて生成できる", () => {
  const { viewStateStore, settingsStore, result, event, create } = setup();
  create();
  expect(viewStateStore.getState().lineCreationMode).toBe(false);
  act(() => {
    result.current.onPointerDown(event(200, 200));
    result.current.onPointerMove(event(200, 250));
    result.current.onPointerUp(event(200, 250));
  });
  expect(viewStateStore.getState().lineCreationMode).toBe(true);
  expect(viewStateStore.getState().editingLineId).toBeNull();
  const count = settingsStore.getState().countingLines.length;
  act(() => {
    result.current.onPointerDown(event(300, 400));
    result.current.onPointerMove(event(700, 400));
    result.current.onPointerUp(event(700, 400));
  });
  expect(settingsStore.getState().countingLines).toHaveLength(count + 1);
});

it("クリックだけ、またはキャンセルでは微調整を終了しない", () => {
  const { viewStateStore, result, event, create } = setup();
  create();
  act(() => {
    result.current.onPointerDown(event(200, 200));
    result.current.onPointerUp(event(200, 200));
  });
  expect(viewStateStore.getState().lineCreationMode).toBe(false);
  act(() => {
    result.current.onPointerDown(event(200, 200));
    result.current.onPointerMove(event(200, 250));
    result.current.onPointerCancel(event(200, 250, "pointercancel"));
  });
  expect(viewStateStore.getState().lineCreationMode).toBe(false);
});

it("既存ラインの編集後は編集モードを維持する", () => {
  const { viewStateStore, settingsStore, result, event } = setup();
  const line = settingsStore.getState().countingLines[0];
  const x = line.p1.x * 1000;
  const y = line.p1.y * 1000;
  act(() => {
    result.current.onPointerDown(event(x, y));
    result.current.onPointerMove(event(x, y + 30));
    result.current.onPointerUp(event(x, y + 30));
  });
  expect(viewStateStore.getState().lineCreationMode).toBe(false);
  expect(viewStateStore.getState().editingLineId).toBe(line.id);
});
