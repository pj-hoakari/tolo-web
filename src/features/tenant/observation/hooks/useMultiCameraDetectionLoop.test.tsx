// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDetectionStores } from "@/features/tenant/detection/stores/detectionStore";
import { createBroadcastStream } from "../utils/broadcastStream";
import { captureCrowdFrame, resetCrowdTracking } from "../utils/detectCrowd";
import {
  type MultiCameraDetectionLoopParams,
  useMultiCameraDetectionLoop,
} from "./useMultiCameraDetectionLoop";

vi.mock("../utils/detectCrowd", () => ({
  createCrowdDetectionState: vi.fn(() => ({})),
  captureCrowdFrame: vi.fn(() => ({})),
  detectCapturedCrowdFrame: vi.fn(async () => ({
    detections: [],
    lineCounts: {},
  })),
  resetCrowdLineCount: vi.fn(),
  resetCrowdTracking: vi.fn(),
}));
vi.mock("../utils/broadcastStream", () => ({
  createBroadcastStream: vi.fn(() => null),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("useMultiCameraDetectionLoop", () => {
  it.each(["waiting", "stale"] as const)(
    "yields to rendering, recovery and stop timers at interval zero when %s",
    async (phase) => {
      const stores = createDetectionStores();
      stores.settingsStore.setState({ detectionInterval: 0 });
      let recovered = false;
      let checks = 0;
      // Bound the pre-fix microtask loop so a regression fails instead of hanging Vitest.
      const ready = () => recovered || ++checks > 100 || phase === "stale";
      vi.spyOn(
        HTMLMediaElement.prototype,
        "readyState",
        "get",
      ).mockImplementation(() =>
        ready() ? HTMLMediaElement.HAVE_CURRENT_DATA : 0,
      );
      vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(
        640,
      );
      vi.spyOn(
        HTMLVideoElement.prototype,
        "videoHeight",
        "get",
      ).mockReturnValue(480);
      const onCameraPhase = vi.fn();
      const params: MultiCameraDetectionLoopParams = {
        ...stores,
        sources: new Map([
          ["camera", { kind: "objectUrl", url: "blob:camera", loop: false }],
        ]),
        selectedKey: "camera",
        isFresh: () => recovered || checks > 100,
        overlayCanvasRef: { current: null },
        status: "detecting",
        cameraSettingsStores: new Map(),
        cameraViewStateStores: new Map(),
        cameraResultStores: new Map(),
        onCameraPhase,
        onBroadcastStreamChange: vi.fn(),
        onDetectionFrame: vi.fn(),
      };
      const { rerender } = renderHook(
        (props) => useMultiCameraDetectionLoop(props),
        { initialProps: params },
      );
      await act(async () => {});
      expect(onCameraPhase.mock.calls).toEqual([["camera", phase, undefined]]);
      expect(captureCrowdFrame).not.toHaveBeenCalled();

      const recoveryTimer = vi.fn(() => {
        recovered = true;
      });
      setTimeout(recoveryTimer, 8);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(16);
      });
      expect(recoveryTimer).toHaveBeenCalledOnce();
      expect(captureCrowdFrame).toHaveBeenCalled();
      expect(createBroadcastStream).toHaveBeenCalled();

      const stopTimer = vi.fn(() => rerender({ ...params, status: "idle" }));
      setTimeout(stopTimer, 1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(stopTimer).toHaveBeenCalledOnce();
      expect(document.querySelector("video")).toBeNull();
      expect(resetCrowdTracking).toHaveBeenCalledOnce();
      const phasesAtStop = onCameraPhase.mock.calls.length;
      const capturesAtStop = vi.mocked(captureCrowdFrame).mock.calls.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(onCameraPhase).toHaveBeenCalledTimes(phasesAtStop);
      expect(captureCrowdFrame).toHaveBeenCalledTimes(capturesAtStop);
    },
  );
});

it("keeps the working camera video, tracking state and cumulative results when another source recovers", async () => {
  const stores = createDetectionStores();
  const camera = createDetectionStores();
  const good = { kind: "objectUrl", url: "blob:good", loop: false } as const;
  const params: MultiCameraDetectionLoopParams = {
    ...stores,
    sources: new Map([["good", good]]),
    selectedKey: "good",
    isFresh: () => false,
    overlayCanvasRef: { current: null },
    status: "detecting",
    cameraSettingsStores: new Map([["good", camera.settingsStore]]),
    cameraViewStateStores: new Map(),
    cameraResultStores: new Map([["good", camera.resultStore]]),
    onCameraPhase: vi.fn(),
    onBroadcastStreamChange: vi.fn(),
    onDetectionFrame: vi.fn(),
  };
  const { rerender } = renderHook(
    (props) => useMultiCameraDetectionLoop(props),
    { initialProps: params },
  );
  const video = document.querySelector("video");
  camera.resultStore.setState({
    lineCounts: { "line-1": { forward: 12, backward: 7 } },
    detectedPeople: { all: { frames: 10, people: 25 } },
  });
  const counts = camera.resultStore.getState();
  rerender({
    ...params,
    sources: new Map([
      ["good", good],
      ["recovered", { kind: "objectUrl", url: "blob:recovered", loop: false }],
    ]),
  });
  await act(async () => {});
  expect(document.querySelector("video")).toBe(video);
  expect(camera.resultStore.getState()).toEqual(counts);
  expect(resetCrowdTracking).not.toHaveBeenCalled();
  expect(document.querySelectorAll("video")).toHaveLength(2);
});

it("infers only the continuous camera one frame at a time and skips burst cameras", async () => {
  const stores = createDetectionStores();
  vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(
    HTMLMediaElement.HAVE_CURRENT_DATA,
  );
  vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(
    640,
  );
  vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(
    480,
  );
  stores.settingsStore.setState({ detectionInterval: 100 });
  const onCameraPhase = vi.fn();
  renderHook(() =>
    useMultiCameraDetectionLoop({
      ...stores,
      sources: new Map([
        ["burst", { kind: "objectUrl", url: "blob:burst", loop: false }],
        ["continuous", { kind: "objectUrl", url: "blob:cont", loop: false }],
      ]),
      selectedKey: "burst",
      continuousKey: "continuous",
      isFresh: () => true,
      overlayCanvasRef: { current: null },
      status: "detecting",
      cameraSettingsStores: new Map(),
      cameraViewStateStores: new Map(),
      cameraResultStores: new Map(),
      onCameraPhase,
      onBroadcastStreamChange: vi.fn(),
      onDetectionFrame: vi.fn(),
    }),
  );
  await act(async () => {});
  expect(captureCrowdFrame).toHaveBeenCalledOnce();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(captureCrowdFrame).toHaveBeenCalledTimes(2);
  expect(onCameraPhase.mock.calls).toEqual([
    ["burst", "skipped"],
    ["continuous", "ready", undefined],
    ["continuous", "ready", undefined],
  ]);
});
