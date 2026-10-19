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

  it("モードの選択状態を伝え、生成と編集を切り替える", () => {
    const { viewStateStore } = renderPanel();
    const group = screen.getByRole("radiogroup", { name: "ライン操作モード" });
    const toggle = radio(group, "ライン生成");
    expect(checked(toggle)).toBe("false");

    fireEvent.click(toggle);

    expect(viewStateStore.getState().lineCreationMode).toBe(true);
    expect(checked(toggle)).toBe("true");
    fireEvent.click(radio(group, "編集モード"));
    expect(viewStateStore.getState().lineCreationMode).toBe(false);
    expect(viewStateStore.getState().editingLineId).toBe(
      viewStateStore.getState().selectedLineId,
    );
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
    expect(
      screen.getByRole("button", { name: "ライン 1の編集を終了" }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "ホールA入口を編集" }));

    expect(stores.viewStateStore.getState().selectedLineId).toBe("second");
    expect(stores.viewStateStore.getState().editingLineId).toBe("second");
    expect(
      screen.getByRole("button", { name: "ライン 1を編集" }),
    ).toBeDefined();
    fireEvent.click(
      screen.getByRole("button", { name: "ホールA入口の編集を終了" }),
    );
    expect(stores.viewStateStore.getState().editingLineId).toBeNull();
  });
});
