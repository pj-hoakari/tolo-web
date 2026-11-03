import { describe, expect, it, vi } from "vitest";
import {
  CAMERA_FRAME_COUNT,
  CAMERA_FRAME_INTERVAL_MS,
  runCameraSchedulerCycle,
  type ScheduledCamera,
} from "./cameraScheduler";

type Frame = { camera: string; index: number };

function createCamera(
  key: string,
  events: string[],
  options: {
    ready?: () => boolean;
    failCaptureAt?: number;
    failInferAt?: number;
    infer?: (frame: Frame) => Promise<void> | void;
  } = {},
): ScheduledCamera<Frame> {
  let captured = 0;
  return {
    key,
    isReady: options.ready ?? (() => true),
    capture: () => {
      captured += 1;
      if (captured === options.failCaptureAt) {
        throw new Error(`capture failed: ${key}`);
      }
      events.push(`capture:${key}:${captured}`);
      return { camera: key, index: captured };
    },
    infer: async (frame) => {
      events.push(`infer:${frame.camera}:${frame.index}`);
      if (frame.index === options.failInferAt) {
        throw new Error(`inference failed: ${key}`);
      }
      await options.infer?.(frame);
    },
  };
}

describe("runCameraSchedulerCycle", () => {
  it("processes cameras in order, five frames each, before inference", async () => {
    const events: string[] = [];
    const waits: number[] = [];
    const a = createCamera("a", events);
    const b = createCamera("b", events);

    const outcomes = await runCameraSchedulerCycle([a, b], {
      wait: async (ms) => {
        waits.push(ms);
        events.push(`wait:${ms}`);
      },
    });

    expect(outcomes).toEqual([
      { key: "a", status: "completed" },
      { key: "b", status: "completed" },
    ]);
    expect(events).toEqual([
      "capture:a:1",
      "wait:300",
      "capture:a:2",
      "wait:300",
      "capture:a:3",
      "wait:300",
      "capture:a:4",
      "wait:300",
      "capture:a:5",
      "infer:a:1",
      "infer:a:2",
      "infer:a:3",
      "infer:a:4",
      "infer:a:5",
      "capture:b:1",
      "wait:300",
      "capture:b:2",
      "wait:300",
      "capture:b:3",
      "wait:300",
      "capture:b:4",
      "wait:300",
      "capture:b:5",
      "infer:b:1",
      "infer:b:2",
      "infer:b:3",
      "infer:b:4",
      "infer:b:5",
    ]);
    expect(waits).toEqual(Array(8).fill(CAMERA_FRAME_INTERVAL_MS));
    expect(
      events.filter((event) => event.startsWith("capture:a")),
    ).toHaveLength(CAMERA_FRAME_COUNT);
  });

  it("does not capture the next camera while the current inference is running", async () => {
    const events: string[] = [];
    let releaseInference: (() => void) | undefined;
    const inferenceGate = new Promise<void>((resolve) => {
      releaseInference = resolve;
    });
    const a = createCamera("a", events, {
      infer: async () => {
        await inferenceGate;
      },
    });
    const b = createCamera("b", events);

    const running = runCameraSchedulerCycle([a, b], {
      wait: async () => {},
    });

    await vi.waitFor(() => {
      expect(events).toContain("infer:a:1");
    });
    expect(events).not.toContain("capture:b:1");

    releaseInference?.();
    await running;

    expect(events.indexOf("capture:b:1")).toBeGreaterThan(
      events.lastIndexOf("infer:a:5"),
    );
  });

  it("skips cameras that are not ready and continues with the next one", async () => {
    const events: string[] = [];
    const a = createCamera("a", events, { ready: () => false });
    const b = createCamera("b", events);
    const phases: string[] = [];
    a.onPhase = (phase) => phases.push(`a:${phase}`);

    const outcomes = await runCameraSchedulerCycle([a, b], {
      wait: async () => {},
    });

    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      "skipped",
      "completed",
    ]);
    expect(events).not.toContain("capture:a:1");
    expect(events).not.toContain("infer:a:1");
    expect(phases).toEqual(["a:waiting"]);
    expect(
      events.filter((event) => event.startsWith("capture:b")),
    ).toHaveLength(CAMERA_FRAME_COUNT);
  });

  it("skips a camera whose capture fails and continues with the next one", async () => {
    const events: string[] = [];
    const a = createCamera("a", events, { failCaptureAt: 2 });
    const b = createCamera("b", events);
    const phases: string[] = [];
    a.onPhase = (phase) => phases.push(`a:${phase}`);

    const outcomes = await runCameraSchedulerCycle([a, b], {
      wait: async () => {},
    });

    expect(outcomes[0]).toMatchObject({ key: "a", status: "error" });
    expect(outcomes[1]).toEqual({ key: "b", status: "completed" });
    expect(events).not.toContain("infer:a:1");
    expect(phases).toEqual(["a:capturing", "a:error"]);
  });

  it("stops a camera whose inference fails and continues with the next one", async () => {
    const events: string[] = [];
    const a = createCamera("a", events, { failInferAt: 2 });
    const b = createCamera("b", events);

    const outcomes = await runCameraSchedulerCycle([a, b], {
      wait: async () => {},
    });

    expect(outcomes[0]).toMatchObject({ key: "a", status: "error" });
    expect(outcomes[1]).toEqual({ key: "b", status: "completed" });
    expect(events).toContain("infer:a:2");
    expect(events).not.toContain("infer:a:3");
    expect(events).toContain("capture:b:1");
  });

  it("stops between steps when cancelled", async () => {
    const events: string[] = [];
    let cancelled = false;
    const a = createCamera("a", events);
    a.onPhase = (phase) => {
      if (phase === "inferring") {
        cancelled = true;
      }
    };
    const b = createCamera("b", events);

    await runCameraSchedulerCycle([a, b], {
      wait: async () => {},
      isCancelled: () => cancelled,
    });

    expect(events).not.toContain("infer:a:1");
    expect(events).not.toContain("capture:b:1");
  });
});
