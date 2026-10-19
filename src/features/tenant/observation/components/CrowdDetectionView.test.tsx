// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDetectionStores } from "@/features/tenant/detection/stores/detectionStore";
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
});
