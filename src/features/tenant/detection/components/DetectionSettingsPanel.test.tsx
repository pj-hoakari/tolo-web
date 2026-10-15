// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import {
  createDetectionStores,
  DEFAULT_COUNTING_LINES,
  INITIAL_SETTINGS,
} from "../stores/detectionStore";
import { DetectionLineCountList } from "./DetectionLineCountList";
import { DetectionSettingsPanel } from "./DetectionSettingsPanel";

afterEach(cleanup);

const radio = (group: HTMLElement, name: string) =>
  within(group).getByRole("radio", { name });

const checked = (element: HTMLElement) => element.getAttribute("aria-checked");

const renderPanel = () => {
  const stores = createDetectionStores();
  render(
    <DetectionSettingsPanel
      settingsStore={stores.settingsStore}
      viewStateStore={stores.viewStateStore}
    />,
    { wrapper: IntlTestProvider },
  );
  return stores;
};

describe("DetectionSettingsPanel", () => {
  it("プリセットはグループ名付きで選択中の値を伝え、押すと選択が移る", () => {
    const { settingsStore } = renderPanel();
    const confidence = screen.getByRole("radiogroup", { name: "検出感度" });
    const tracking = screen.getByRole("radiogroup", {
      name: "追跡のつながりやすさ",
    });
    expect(checked(radio(confidence, "標準"))).toBe("true");

    fireEvent.click(radio(confidence, "厳しめ"));

    expect(settingsStore.getState().confidenceThreshold).toBe(0.3);
    expect(checked(radio(confidence, "厳しめ"))).toBe("true");
    expect(checked(radio(confidence, "標準"))).toBe("false");
    expect(checked(radio(tracking, "標準"))).toBe("true");
  });

  it("ライン生成の切替は押下状態を伝える", () => {
    const { viewStateStore } = renderPanel();
    const toggle = screen.getByRole("button", { name: "ライン生成" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(toggle);

    expect(viewStateStore.getState().lineCreationMode).toBe(true);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("DetectionLineCountList", () => {
  it("選択中のラインを伝え、押したラインに選択が移る", () => {
    const stores = createDetectionStores({
      ...INITIAL_SETTINGS,
      countingLines: [
        ...DEFAULT_COUNTING_LINES,
        { ...DEFAULT_COUNTING_LINES[0], id: "second", name: "ホールA入口" },
      ],
    });
    render(<DetectionLineCountList {...stores} />, {
      wrapper: IntlTestProvider,
    });
    const list = screen.getByRole("radiogroup", { name: "ライン一覧" });
    const first = radio(list, "ライン 1: forward 0 / backward 0");
    const second = radio(list, "ホールA入口: forward 0 / backward 0");
    expect(checked(first)).toBe("true");

    fireEvent.click(second);

    expect(stores.viewStateStore.getState().selectedLineId).toBe("second");
    expect(checked(second)).toBe("true");
    expect(checked(first)).toBe("false");
  });
});
