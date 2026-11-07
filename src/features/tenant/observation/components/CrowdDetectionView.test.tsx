// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyLineCounts,
  createDetectionStores,
  INITIAL_SETTINGS,
} from "@/features/tenant/detection/stores/detectionStore";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import { CrowdDetectionView } from "./CrowdDetectionView";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CrowdDetectionView", () => {
  it("検出エラーをアラートで伝え、停止すると消す", () => {
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    const props = {
      ...createDetectionStores(),
      videoSource: null,
      videoRef: createRef<HTMLVideoElement>(),
      overlayCanvasRef: createRef<HTMLCanvasElement>(),
      error: "検出器の初期化に失敗しました",
    };
    const { rerender } = render(
      <CrowdDetectionView {...props} status="idle" />,
      { wrapper: IntlTestProvider },
    );
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(<CrowdDetectionView {...props} status="error" />);
    expect(screen.getByRole("alert").textContent).toBe(props.error);
    rerender(<CrowdDetectionView {...props} status="idle" error={null} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("選択中のカメラのストアが切り替わるとライン数と設定も切り替える", () => {
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    const base = {
      videoSource: null,
      status: "idle" as const,
      error: null,
      videoRef: createRef<HTMLVideoElement>(),
      overlayCanvasRef: createRef<HTMLCanvasElement>(),
      lineCanvasRef: createRef<HTMLCanvasElement>(),
    };
    const first = createDetectionStores({
      ...INITIAL_SETTINGS,
      confidenceThreshold: 0.1,
      countingLines: [
        {
          ...INITIAL_SETTINGS.countingLines[0],
          id: "first-line",
          name: "入口A",
        },
      ],
    });
    const second = createDetectionStores({
      ...INITIAL_SETTINGS,
      confidenceThreshold: 0.3,
      countingLines: [
        {
          ...INITIAL_SETTINGS.countingLines[0],
          id: "second-line",
          name: "入口B",
        },
      ],
    });
    applyLineCounts(first.resultStore, {
      "first-line": { forward: 3, backward: 1 },
    });
    applyLineCounts(second.resultStore, {
      "second-line": { forward: 8, backward: 2 },
    });

    const { rerender } = render(
      <CrowdDetectionView
        {...base}
        settingsStore={first.settingsStore}
        resultStore={first.resultStore}
        viewStateStore={first.viewStateStore}
      />,
      { wrapper: IntlTestProvider },
    );

    const firstConfidence = screen.getByRole("radiogroup", {
      name: "検出感度",
    });
    expect(
      within(firstConfidence)
        .getByRole("radio", { name: "広め" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(screen.getByText("入口A: forward 3 / backward 1")).toBeDefined();
    expect(screen.queryByText("入口B: forward 8 / backward 2")).toBeNull();

    rerender(
      <CrowdDetectionView
        {...base}
        settingsStore={second.settingsStore}
        resultStore={second.resultStore}
        viewStateStore={second.viewStateStore}
      />,
    );

    const secondConfidence = screen.getByRole("radiogroup", {
      name: "検出感度",
    });
    expect(
      within(secondConfidence)
        .getByRole("radio", { name: "厳しめ" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(screen.getByText("入口B: forward 8 / backward 2")).toBeDefined();
    expect(screen.queryByText("入口A: forward 3 / backward 1")).toBeNull();
  });
});
