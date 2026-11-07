// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEspCameraAutoStart } from "./useEspCameraAutoStart";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useEspCameraAutoStart", () => {
  it("カメラが利用可能になったら一度だけ開始する", () => {
    const start = vi.fn();
    const { rerender } = renderHook(
      ({ enabled, cameraIds }) =>
        useEspCameraAutoStart({ enabled, cameraIds, start }),
      {
        initialProps: { enabled: true, cameraIds: [] as string[] },
      },
    );
    expect(start).not.toHaveBeenCalled();

    rerender({ enabled: true, cameraIds: ["camera-1", "camera-2"] });
    expect(start).toHaveBeenCalledTimes(1);

    rerender({ enabled: true, cameraIds: ["camera-1", "camera-2"] });
    expect(start).toHaveBeenCalledTimes(1);

    rerender({
      enabled: true,
      cameraIds: ["camera-1", "camera-2", "camera-3"],
    });
    expect(start).toHaveBeenCalledTimes(2);
  });

  it("ESP モードでないときは開始しない", () => {
    const start = vi.fn();
    const { rerender } = renderHook(
      ({ enabled, cameraIds }) =>
        useEspCameraAutoStart({ enabled, cameraIds, start }),
      {
        initialProps: { enabled: false, cameraIds: ["camera-1"] },
      },
    );
    expect(start).not.toHaveBeenCalled();

    rerender({ enabled: true, cameraIds: ["camera-1"] });
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("start が変わってもカメラ構成が同じなら再開始せず、最新の start を使う", () => {
    const firstStart = vi.fn();
    const secondStart = vi.fn();
    const { rerender } = renderHook(
      ({ start, cameraIds }) =>
        useEspCameraAutoStart({ enabled: true, cameraIds, start }),
      {
        initialProps: {
          start: firstStart,
          cameraIds: ["camera-1"],
        },
      },
    );
    expect(firstStart).toHaveBeenCalledTimes(1);

    rerender({ start: secondStart, cameraIds: ["camera-1"] });
    expect(firstStart).toHaveBeenCalledTimes(1);
    expect(secondStart).not.toHaveBeenCalled();

    rerender({ start: secondStart, cameraIds: ["camera-1", "camera-2"] });
    expect(firstStart).toHaveBeenCalledTimes(1);
    expect(secondStart).toHaveBeenCalledTimes(1);
  });

  it("カメラ一覧が空になった後に再び利用可能になるともう一度開始する", () => {
    const start = vi.fn();
    const { rerender } = renderHook(
      ({ cameraIds }) =>
        useEspCameraAutoStart({ enabled: true, cameraIds, start }),
      {
        initialProps: { cameraIds: ["camera-1"] },
      },
    );
    expect(start).toHaveBeenCalledTimes(1);

    rerender({ cameraIds: [] });
    rerender({ cameraIds: ["camera-1"] });
    expect(start).toHaveBeenCalledTimes(2);
  });
});
