// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDetectionResultStore,
  createDetectionStores,
  DEFAULT_LINE_ID,
  INITIAL_SETTINGS,
} from "@/features/tenant/detection/stores/detectionStore";
import {
  type ObservationReportingCamera,
  useObservationReporting,
} from "./useObservationReporting";

const heartbeat = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const reportMeasurements = vi.hoisted(() =>
  vi.fn((_input: unknown) => Promise.resolve()),
);
const observationPoints = vi.hoisted(
  () => [] as { observationPointId: string; name: string }[],
);

vi.mock("@/lib/orpc", () => ({
  orpc: {
    observation: {
      heartbeat,
      listObservationPoints: () => Promise.resolve({ observationPoints }),
      reportMeasurements,
    },
  },
}));

const { settingsStore, resultStore } = createDetectionStores();

function renderReporting(initial: {
  edgeDeviceId: string;
  listening: boolean;
}) {
  return renderHook(
    (props: { edgeDeviceId: string; listening: boolean }) =>
      useObservationReporting({
        eventId: "test",
        status: "idle",
        settingsStore,
        resultStore,
        ...props,
      }),
    { initialProps: initial },
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  heartbeat.mockClear();
  reportMeasurements.mockReset();
  reportMeasurements.mockResolvedValue(undefined);
  observationPoints.length = 0;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useObservationReporting", () => {
  it("待ち受けていない間は Heartbeat を送らない", async () => {
    renderReporting({ edgeDeviceId: "0123456789abcdef", listening: false });

    await act(() => vi.advanceTimersByTimeAsync(60_000));

    expect(heartbeat).not.toHaveBeenCalled();
  });

  it("待ち受けを始めるとすぐに送り、10 秒ごとに送り、やめると止める", async () => {
    const { rerender } = renderReporting({
      edgeDeviceId: "0123456789abcdef",
      listening: true,
    });
    await act(() => vi.advanceTimersByTimeAsync(0));
    const sentWhileListening = heartbeat.mock.calls.length;
    expect(sentWhileListening).toBeGreaterThanOrEqual(1);
    expect(heartbeat).toHaveBeenLastCalledWith({
      eventId: "test",
      edgeDeviceId: "0123456789abcdef",
      activeObservationPointIds: [],
    });

    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(heartbeat).toHaveBeenCalledTimes(sentWhileListening + 1);

    rerender({ edgeDeviceId: "0123456789abcdef", listening: false });
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(heartbeat).toHaveBeenCalledTimes(sentWhileListening + 1);
  });
});

describe("計測値の送信に失敗したとき", () => {
  const REPORT_INTERVAL_MS = 30_000;
  const sentWindowStarts = (call: number) =>
    (
      reportMeasurements.mock.calls[call][0] as {
        measurements: { windowStart: Date }[];
      }
    ).measurements.map((m) => m.windowStart.getTime());

  async function startDetecting() {
    observationPoints.push({
      observationPointId: "a1b2c3d4e5f60718",
      name: "入口",
    });
    const stores = createDetectionStores({
      ...INITIAL_SETTINGS,
      countingLines: [
        {
          ...INITIAL_SETTINGS.countingLines[0],
          id: DEFAULT_LINE_ID,
          name: "入口",
        },
      ],
    });
    const rendered = renderHook(
      (props: { edgeDeviceId: string }) =>
        useObservationReporting({
          eventId: "test",
          listening: false,
          status: "detecting",
          ...stores,
          ...props,
        }),
      { initialProps: { edgeDeviceId: "8c1f0e2a5d4b3c6e" } },
    );
    await act(() => vi.advanceTimersByTimeAsync(0));
    return rendered;
  }

  it("保持するのは新しい 120 ウィンドウまでで、超えた分は古いウィンドウから捨てる", async () => {
    reportMeasurements.mockRejectedValue(new Error("network"));
    await startDetecting();

    await act(() => vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS * 121));
    const firstWindowStart = sentWindowStarts(0)[0];
    reportMeasurements.mockResolvedValue(undefined);
    await act(() => vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS));

    const resent = sentWindowStarts(121);
    expect(resent).toHaveLength(121);
    expect(resent).not.toContain(firstWindowStart);
    expect(resent[0]).toBe(firstWindowStart + REPORT_INTERVAL_MS);
  });

  it("観測デバイスが替わると、前の観測デバイスで送信に失敗したウィンドウの計測値を再送しない", async () => {
    reportMeasurements.mockRejectedValue(new Error("network"));
    const { rerender } = await startDetecting();
    await act(() => vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS));

    reportMeasurements.mockResolvedValue(undefined);
    rerender({ edgeDeviceId: "0123456789abcdef" });
    await act(() => vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS));

    expect(reportMeasurements).toHaveBeenLastCalledWith(
      expect.objectContaining({ edgeDeviceId: "0123456789abcdef" }),
    );
    expect(sentWindowStarts(1)).toHaveLength(1);
    expect(sentWindowStarts(1)).not.toContain(sentWindowStarts(0)[0]);
  });
});

describe("複数カメラの計測報告", () => {
  const REPORT_INTERVAL_MS = 30_000;
  const lineId = INITIAL_SETTINGS.countingLines[0].id;

  function createCamera(
    key: string,
    observationPointId: string,
  ): ObservationReportingCamera {
    return {
      key,
      observationPointId,
      resultStore: createDetectionResultStore(INITIAL_SETTINGS.countingLines),
    };
  }

  function setLineCounts(
    camera: ObservationReportingCamera,
    forward: number,
    backward: number,
  ) {
    camera.resultStore.setState((current) => ({
      ...current,
      lineCounts: {
        ...current.lineCounts,
        [lineId]: { forward, backward },
      },
    }));
  }

  function renderCameraReporting(
    cameras: ObservationReportingCamera[],
    options: { listening?: boolean } = {},
  ) {
    return renderHook(() =>
      useObservationReporting({
        eventId: "test",
        edgeDeviceId: "0123456789abcdef",
        listening: options.listening ?? false,
        status: "detecting",
        settingsStore,
        resultStore: resultStore,
        cameras,
      }),
    );
  }

  it("camera ごとの通過数を cameraLinks の観測点へ対応づけて送る", async () => {
    const first = createCamera("first", "a1b2c3d4e5f60718");
    const second = createCamera("second", "b1b2c3d4e5f60718");
    const unlinked = createCamera("unlinked", "");
    renderCameraReporting([first, second, unlinked]);
    await act(() => vi.advanceTimersByTimeAsync(0));

    act(() => {
      setLineCounts(first, 3, 1);
      setLineCounts(second, 2, 4);
      setLineCounts(unlinked, 9, 9);
    });

    await act(() => vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS));

    expect(reportMeasurements).toHaveBeenCalledTimes(1);
    expect(reportMeasurements.mock.calls[0][0]).toMatchObject({
      measurements: expect.arrayContaining([
        expect.objectContaining({
          observationPointId: "a1b2c3d4e5f60718",
          countIn: 3,
          countOut: 1,
        }),
        expect.objectContaining({
          observationPointId: "b1b2c3d4e5f60718",
          countIn: 2,
          countOut: 4,
        }),
      ]),
    });
    const sent = (
      reportMeasurements.mock.calls[0][0] as {
        measurements: { observationPointId: string }[];
      }
    ).measurements;
    expect(sent).toHaveLength(2);
    expect(
      sent.map((measurement) => measurement.observationPointId),
    ).not.toContain("");
  });

  it("紐づけのないカメラだけなら計測値を送らない", async () => {
    const unlinked = createCamera("unlinked", "");
    renderCameraReporting([unlinked]);
    await act(() => vi.advanceTimersByTimeAsync(0));
    setLineCounts(unlinked, 5, 5);

    await act(() => vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS * 2));

    expect(reportMeasurements).not.toHaveBeenCalled();
  });

  it("検出中は全カメラの紐づけ先を Heartbeat の対象にする", async () => {
    const first = createCamera("first", "a1b2c3d4e5f60718");
    const second = createCamera("second", "b1b2c3d4e5f60718");
    const unlinked = createCamera("unlinked", "");
    renderCameraReporting([first, second, unlinked], { listening: true });
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(heartbeat).toHaveBeenLastCalledWith({
      eventId: "test",
      edgeDeviceId: "0123456789abcdef",
      activeObservationPointIds: ["a1b2c3d4e5f60718", "b1b2c3d4e5f60718"],
    });
  });
});
