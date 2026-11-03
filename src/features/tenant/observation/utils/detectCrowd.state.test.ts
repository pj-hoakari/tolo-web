import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type CrowdDetectionState,
  captureCrowdFrame,
  createCrowdDetectionState,
  detectCapturedCrowdFrame,
  resetCrowdLineCount,
  resetCrowdTracking,
} from "./detectCrowd";

vi.mock("@pj-hoakari/web-crowd-detection-utils/yolo", () => ({
  createYoloDetector: vi.fn(async () => ({
    detect: vi.fn(async () => []),
  })),
}));
vi.mock("@pj-hoakari/web-crowd-detection-utils/onnx", () => ({
  isWebGpuAvailable: () => false,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const capturedFrame = {
  imageData: {
    width: 640,
    height: 640,
    data: new Uint8ClampedArray(640 * 640 * 4),
    colorSpace: "srgb",
  } as ImageData,
  params: {
    inputSize: 640,
    sourceWidth: 1280,
    sourceHeight: 720,
    scale: 0.5,
    padX: 0,
    padY: 140,
    contentWidth: 640,
    contentHeight: 360,
  },
};

function installFakeCapturer(
  state: CrowdDetectionState,
): ReturnType<typeof vi.fn> {
  const capture = vi.fn(() => capturedFrame);
  state.capturer = {
    inputSize: 640,
    canvas: {} as HTMLCanvasElement,
    capture,
  };
  return capture;
}

describe("per-camera crowd detection state", () => {
  it("creates independent tracker, line counter and background state", () => {
    const first = createCrowdDetectionState();
    const second = createCrowdDetectionState();

    expect(first.tracker).not.toBe(second.tracker);
    expect(first.lineCrossingCounter).not.toBe(second.lineCrossingCounter);
    expect(first.backgroundSubtractor).not.toBe(second.backgroundSubtractor);
    expect(first.capturer).toBeNull();
    expect(second.capturer).toBeNull();
  });

  it("resets only the state passed in", () => {
    const first = createCrowdDetectionState();
    const second = createCrowdDetectionState();
    const firstTrackerReset = vi.spyOn(first.tracker, "reset");
    const secondTrackerReset = vi.spyOn(second.tracker, "reset");
    const firstLineReset = vi.spyOn(first.lineCrossingCounter, "reset");
    const secondLineReset = vi.spyOn(second.lineCrossingCounter, "reset");
    const firstBackgroundReset = vi.spyOn(first.backgroundSubtractor, "reset");
    const secondBackgroundReset = vi.spyOn(
      second.backgroundSubtractor,
      "reset",
    );

    resetCrowdTracking(first);

    expect(firstTrackerReset).toHaveBeenCalledOnce();
    expect(firstLineReset).toHaveBeenCalledOnce();
    expect(firstBackgroundReset).toHaveBeenCalledOnce();
    expect(secondTrackerReset).not.toHaveBeenCalled();
    expect(secondLineReset).not.toHaveBeenCalled();
    expect(secondBackgroundReset).not.toHaveBeenCalled();

    resetCrowdLineCount(second);

    expect(secondLineReset).toHaveBeenCalledOnce();
    expect(firstLineReset).toHaveBeenCalledOnce();
  });

  it("captures through the capturer owned by the given state", () => {
    const first = createCrowdDetectionState();
    const second = createCrowdDetectionState();
    const firstCapture = installFakeCapturer(first);
    const secondCapture = installFakeCapturer(second);
    const firstVideo = { id: "first" } as unknown as HTMLVideoElement;
    const secondVideo = { id: "second" } as unknown as HTMLVideoElement;

    expect(captureCrowdFrame(firstVideo, first)).toBe(capturedFrame);
    expect(captureCrowdFrame(secondVideo, second)).toBe(capturedFrame);
    expect(firstCapture).toHaveBeenCalledOnce();
    expect(firstCapture.mock.calls[0][0]).toBe(firstVideo);
    expect(secondCapture).toHaveBeenCalledOnce();
    expect(secondCapture.mock.calls[0][0]).toBe(secondVideo);
  });
});

describe("detectCapturedCrowdFrame", () => {
  it("updates only the tracker, line counter and background of the given state", async () => {
    vi.stubEnv("NEXT_PUBLIC_CROWD_DETECTION_MOCKING", undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("model")),
    );
    const first = createCrowdDetectionState();
    const second = createCrowdDetectionState();
    const firstBackground = vi.spyOn(first.backgroundSubtractor, "update");
    const secondBackground = vi.spyOn(second.backgroundSubtractor, "update");
    const firstTracker = vi.spyOn(first.tracker, "update");
    const secondTracker = vi.spyOn(second.tracker, "update");
    const firstCounter = vi.spyOn(first.lineCrossingCounter, "update");
    const secondCounter = vi.spyOn(second.lineCrossingCounter, "update");

    const frame = await detectCapturedCrowdFrame(
      capturedFrame,
      {
        confidenceThreshold: 0.15,
        trackingDistanceThreshold: 0.8,
        countingLines: [],
      },
      first,
    );

    expect(frame.detections).toEqual([]);
    expect(firstBackground).toHaveBeenCalledOnce();
    expect(firstTracker).toHaveBeenCalledOnce();
    expect(firstCounter).toHaveBeenCalledOnce();
    expect(secondBackground).not.toHaveBeenCalled();
    expect(secondTracker).not.toHaveBeenCalled();
    expect(secondCounter).not.toHaveBeenCalled();
  });
});
