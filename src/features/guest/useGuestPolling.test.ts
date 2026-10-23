// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GUEST_REFRESH_INTERVAL_MS, useGuestPolling } from "./useGuestPolling";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const settle = () => act(() => vi.advanceTimersByTimeAsync(0));
const nextRefresh = () =>
  act(() => vi.advanceTimersByTimeAsync(GUEST_REFRESH_INTERVAL_MS));

describe("useGuestPolling", () => {
  it("loads once and loads again every minute", async () => {
    const load = vi
      .fn<() => Promise<number>>()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    const { result } = renderHook(() => useGuestPolling(load));
    expect(result.current).toEqual({ status: "loading" });

    await settle();
    expect(result.current).toEqual({ status: "ready", data: 1 });

    await nextRefresh();
    expect(result.current).toEqual({ status: "ready", data: 2 });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps the last data when a refresh fails", async () => {
    const load = vi
      .fn<() => Promise<number>>()
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useGuestPolling(load));
    await settle();

    await nextRefresh();
    expect(result.current).toEqual({ status: "ready", data: 1 });
  });

  it("reports an error until a later refresh succeeds", async () => {
    const load = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(3);
    const { result } = renderHook(() => useGuestPolling(load));
    await settle();
    expect(result.current).toEqual({ status: "error" });

    await nextRefresh();
    expect(result.current).toEqual({ status: "ready", data: 3 });
  });

  it("stops loading after unmount", async () => {
    const load = vi.fn<() => Promise<number>>().mockResolvedValue(1);
    const { unmount } = renderHook(() => useGuestPolling(load));
    await settle();
    unmount();

    await nextRefresh();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
