// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDetectionStores,
  DEFAULT_LINE_ID,
  INITIAL_SETTINGS,
} from "@/features/tenant/detection/stores/detectionStore";
import { useObservationReporting } from "./useObservationReporting";

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
