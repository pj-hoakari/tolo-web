// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDetectionStores } from "@/features/tenant/detection/stores/detectionStore";
import { useObservationReporting } from "./useObservationReporting";

const heartbeat = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("@/lib/orpc", () => ({
  orpc: {
    observation: {
      heartbeat,
      listObservationPoints: () => Promise.resolve({ observationPoints: [] }),
      reportMeasurements: () => Promise.resolve(),
    },
  },
}));

const { settingsStore, resultStore } = createDetectionStores();

function renderReporting(initial: {
  edgeDeviceId: string | undefined;
  listening: boolean;
}) {
  return renderHook(
    (props: { edgeDeviceId: string | undefined; listening: boolean }) =>
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

  it("エッジ端末 ID が無ければ Heartbeat を送らない", async () => {
    renderReporting({ edgeDeviceId: undefined, listening: true });

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
