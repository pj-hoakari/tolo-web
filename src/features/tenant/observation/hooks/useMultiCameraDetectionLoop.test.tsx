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
