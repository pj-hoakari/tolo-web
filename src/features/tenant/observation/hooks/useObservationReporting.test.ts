// @vitest-environment jsdom

import { ORPCError } from "@orpc/client";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDetectionResultStore,
  createDetectionStores,
  DEFAULT_LINE_ID,
  INITIAL_SETTINGS,
  recordDetectedPeople,
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
        isFresh: () => true,
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
  it("disables Heartbeat and measurements for staff, including after reporting was active", async () => {
    const stores = createDetectionStores();
    const camera: ObservationReportingCamera = {
      key: "camera",
      observationPointId: "point",
      ...stores,
    };
    const { rerender } = renderHook(
      ({ enabled }) =>
        useObservationReporting({
          enabled,
          eventId: "event",
          edgeDeviceId: "edge",
          listening: true,
          status: "detecting",
          ...stores,
          cameras: [camera],
          isFresh: () => true,
        }),
      { initialProps: { enabled: false } },
    );
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(heartbeat).not.toHaveBeenCalled();
    expect(reportMeasurements).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(heartbeat).toHaveBeenCalled();
    expect(reportMeasurements).toHaveBeenCalled();
    heartbeat.mockClear();
    reportMeasurements.mockClear();
    rerender({ enabled: false });
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(heartbeat).not.toHaveBeenCalled();
    expect(reportMeasurements).not.toHaveBeenCalled();
  });

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
          isFresh: () => true,
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

  it.each(["BAD_REQUEST", "FORBIDDEN", "NOT_FOUND"])(
    "%s で断られた送信のウィンドウは再送しない",
    async (code) => {
      reportMeasurements.mockRejectedValueOnce(new ORPCError(code));
      await startDetecting();
      await act(() => vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS * 2));

      expect(sentWindowStarts(1)).toEqual([
        sentWindowStarts(0)[0] + REPORT_INTERVAL_MS,
      ]);
    },
  );

  it("認証の失敗で断られた送信のウィンドウは再送する", async () => {
    reportMeasurements.mockRejectedValueOnce(new ORPCError("UNAUTHORIZED"));
    await startDetecting();
    await act(() => vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS * 2));

    expect(sentWindowStarts(1)).toEqual([
      sentWindowStarts(0)[0],
      sentWindowStarts(0)[0] + REPORT_INTERVAL_MS,
    ]);
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

  function createCamera(
    key: string,
    observationPointId: string,
    options: { lineId?: string; lineName?: string } = {},
  ): ObservationReportingCamera {
    const countingLines = [
      {
        ...INITIAL_SETTINGS.countingLines[0],
        id: options.lineId ?? INITIAL_SETTINGS.countingLines[0].id,
        name: options.lineName ?? "",
      },
    ];
    const cameraStores = createDetectionStores({
      ...INITIAL_SETTINGS,
      countingLines,
    });
    return {
      key,
      observationPointId,
      settingsStore: cameraStores.settingsStore,
      resultStore: createDetectionResultStore(countingLines),
    };
  }

  function setLineCounts(
    camera: ObservationReportingCamera,
    forward: number,
    backward: number,
  ) {
    const [line] = camera.settingsStore.getState().countingLines;
    camera.resultStore.setState((current) => ({
      ...current,
      lineCounts: {
        ...current.lineCounts,
        [line.id]: { forward, backward },
      },
    }));
  }

  function renderCameraReporting(
    cameras: ObservationReportingCamera[],
    options: {
      listening?: boolean;
      isFresh?: (key: string) => boolean;
    } = {},
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
        isFresh: options.isFresh ?? (() => true),
      }),
    );
  }

  it("カメラで記録した人数を紐づく観測点の平均人数として送る", async () => {
    const camera = createCamera("first", "a1b2c3d4e5f60718");
    renderCameraReporting([camera]);
    await act(() => vi.advanceTimersByTimeAsync(0));
    act(() => {
      recordDetectedPeople(camera.resultStore, 4);
      recordDetectedPeople(camera.resultStore, 0);
    });
    await act(() => vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS));
    expect(reportMeasurements).toHaveBeenCalledWith(
      expect.objectContaining({
        measurements: [
          expect.objectContaining({
            observationPointId: camera.observationPointId,
            meanDetectedPeople: 2,
          }),
        ],
      }),
    );
  });

  it("映像が停止する直前の通過数を復帰後に重複させず報告する", async () => {
    let fresh = true;
    const camera = createCamera("first", "a1b2c3d4e5f60718");
    renderCameraReporting([camera], { isFresh: () => fresh });
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    act(() => setLineCounts(camera, 3, 0));
    fresh = false;
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    fresh = true;
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    act(() => setLineCounts(camera, 5, 0));
    await act(() => vi.advanceTimersByTimeAsync(25_000));
    const measurements = (
      reportMeasurements.mock.calls[0][0] as {
        measurements: { countIn: number }[];
      }
    ).measurements;
    expect(measurements.map((m) => m.countIn)).toEqual([3, 2]);
  });

  it("ライン変更でカウントがリセットされても変更前の通過数を残す", async () => {
    const camera = createCamera("first", "a1b2c3d4e5f60718");
    renderCameraReporting([camera]);
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    act(() => {
      setLineCounts(camera, 3, 0);
      camera.settingsStore.setState((state) => ({
        countingLines: state.countingLines.map((line) => ({
          ...line,
          name: "changed",
        })),
      }));
      setLineCounts(camera, 0, 0);
      setLineCounts(camera, 2, 0);
    });
    await act(() => vi.advanceTimersByTimeAsync(29_000));
    const measurements = (
      reportMeasurements.mock.calls[0][0] as {
        measurements: { countIn: number }[];
      }
    ).measurements;
    expect(measurements.map((m) => m.countIn)).toEqual([3, 2]);
  });

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

  it("カメラごとの設定ストアのラインで、そのカメラの観測点へ計測値を送る", async () => {
    const first = createCamera("first", "a1b2c3d4e5f60718", {
      lineId: "first-line",
      lineName: "入口",
    });
    const second = createCamera("second", "b1b2c3d4e5f60718", {
      lineId: "second-line",
      lineName: "出口",
    });
    renderCameraReporting([first, second]);
    await act(() => vi.advanceTimersByTimeAsync(0));

    act(() => {
      setLineCounts(first, 7, 2);
      setLineCounts(second, 1, 5);
    });

    await act(() => vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS));

    expect(reportMeasurements).toHaveBeenCalledTimes(1);
    const sent = (
      reportMeasurements.mock.calls[0][0] as {
        measurements: {
          observationPointId: string;
          countIn: number;
          countOut: number;
        }[];
      }
    ).measurements;
    expect(sent).toHaveLength(2);
    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          observationPointId: "a1b2c3d4e5f60718",
          countIn: 7,
          countOut: 2,
        }),
        expect.objectContaining({
          observationPointId: "b1b2c3d4e5f60718",
          countIn: 1,
          countOut: 5,
        }),
      ]),
    );
  });

  it("紐づけのないカメラだけなら計測値を送らない", async () => {
    const unlinked = createCamera("unlinked", "");
    renderCameraReporting([unlinked]);
    await act(() => vi.advanceTimersByTimeAsync(0));
    setLineCounts(unlinked, 5, 5);

    await act(() => vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS * 2));

    expect(reportMeasurements).not.toHaveBeenCalled();
  });

  it("新しい映像が届いているカメラだけを Heartbeat と計測の対象にし、復帰すると再開する", async () => {
    const freshKeys = new Set(["first"]);
    const isFresh = (key: string) => freshKeys.has(key);
    const first = createCamera("first", "a1b2c3d4e5f60718");
    const second = createCamera("second", "b1b2c3d4e5f60718");
    renderCameraReporting([first, second], { listening: true, isFresh });
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(heartbeat).toHaveBeenLastCalledWith({
      eventId: "test",
      edgeDeviceId: "0123456789abcdef",
      activeObservationPointIds: ["a1b2c3d4e5f60718"],
    });

    act(() => {
      setLineCounts(first, 2, 0);
      setLineCounts(second, 5, 5);
    });
    await act(() => vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS));

    expect(reportMeasurements).toHaveBeenCalledTimes(1);
    const firstWindow = (
      reportMeasurements.mock.calls[0][0] as {
        measurements: { observationPointId: string; countIn: number }[];
      }
    ).measurements;
    expect(firstWindow).toEqual([
      expect.objectContaining({
        observationPointId: "a1b2c3d4e5f60718",
        countIn: 2,
        countOut: 0,
      }),
    ]);

    freshKeys.add("second");
    act(() => {
      setLineCounts(first, 3, 0);
      setLineCounts(second, 8, 7);
    });
    await act(() => vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS));

    expect(reportMeasurements).toHaveBeenCalledTimes(2);
    const secondWindow = (
      reportMeasurements.mock.calls[1][0] as {
        measurements: { observationPointId: string; countIn: number }[];
      }
    ).measurements;
    expect(secondWindow).toHaveLength(2);
    expect(secondWindow).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          observationPointId: "a1b2c3d4e5f60718",
          countIn: 1,
          countOut: 0,
        }),
        expect.objectContaining({
          observationPointId: "b1b2c3d4e5f60718",
          countIn: 3,
          countOut: 2,
        }),
      ]),
    );

    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(heartbeat).toHaveBeenLastCalledWith({
      eventId: "test",
      edgeDeviceId: "0123456789abcdef",
      activeObservationPointIds: ["a1b2c3d4e5f60718", "b1b2c3d4e5f60718"],
    });
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
