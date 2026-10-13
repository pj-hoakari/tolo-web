// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScreenWakeLock } from "./useScreenWakeLock";

const request = vi.fn<WakeLock["request"]>();

function createSentinel(): WakeLockSentinel {
  const sentinel = Object.assign(new EventTarget(), {
    released: false,
    type: "screen" as const,
    onrelease: null,
    release: vi.fn(async () => {
      sentinel.released = true;
      sentinel.dispatchEvent(new Event("release"));
    }),
  });
  return sentinel;
}

async function returnToVisible() {
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

beforeEach(() => {
  request.mockReset();
  vi.stubGlobal("navigator", { wakeLock: { request } });
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useScreenWakeLock", () => {
  it("取得が拒否されたら OFF に戻り、タブ復帰で再取得しない", async () => {
    request.mockRejectedValue(
      Object.assign(new Error("Wake Lock permission request denied"), {
        name: "NotAllowedError",
      }),
    );
    const { result } = renderHook(() => useScreenWakeLock());

    await act(() => result.current.enable());

    expect(result.current.enabled).toBe(false);
    expect(result.current.isActive).toBe(false);
    expect(result.current.errorKey).toBe("enableError");
    await returnToVisible();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("失敗後にユーザーが再試行し成功したら ON になりエラーが消える", async () => {
    request
      .mockRejectedValueOnce(new Error("Wake Lock permission request denied"))
      .mockResolvedValueOnce(createSentinel());
    const { result } = renderHook(() => useScreenWakeLock());

    await act(() => result.current.enable());
    await act(() => result.current.enable());

    expect(request).toHaveBeenCalledTimes(2);
    expect(result.current.enabled).toBe(true);
    expect(result.current.isActive).toBe(true);
    expect(result.current.errorKey).toBeNull();
  });

  it("解放後は ON 設定を保持するが、タブ復帰時の再取得失敗で OFF に戻る", async () => {
    const sentinel = createSentinel();
    request
      .mockResolvedValueOnce(sentinel)
      .mockRejectedValueOnce(new Error("Wake Lock permission request denied"));
    const { result } = renderHook(() => useScreenWakeLock());

    await act(() => result.current.enable());
    await act(() => sentinel.release());
    expect(result.current.enabled).toBe(true);
    expect(result.current.isActive).toBe(false);

    await returnToVisible();
    expect(result.current.enabled).toBe(false);
    expect(result.current.isActive).toBe(false);
    expect(result.current.errorKey).toBe("enableError");
    await returnToVisible();
    expect(request).toHaveBeenCalledTimes(2);
  });
});
