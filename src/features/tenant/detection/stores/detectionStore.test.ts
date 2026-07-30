import { describe, expect, it, vi } from "vitest";
import {
  applyCountingLines,
  applyLineCounts,
  applyMetrics,
  applyNumberSetting,
  applySettings,
  createDetectionStores,
  type DetectionSettings,
  INITIAL_SETTINGS,
  parseDetectionSettings,
  selectLine,
  toggleLineCreationMode,
} from "./detectionStore";

describe("applyCountingLines", () => {
  it("0〜1 の範囲に丸める", () => {
    const { settingsStore } = createDetectionStores();

    applyCountingLines(settingsStore, [
      { id: "line-1", p1: { x: -0.5, y: 0.2 }, p2: { x: 1.5, y: 0.2 } },
    ]);

    expect(settingsStore.getState().countingLines).toEqual([
      { id: "line-1", p1: { x: 0, y: 0.2 }, p2: { x: 1, y: 0.2 } },
    ]);
  });

  it("同じ内容なら通知しない", () => {
    const { settingsStore } = createDetectionStores();
    const listener = vi.fn();
    settingsStore.subscribe(listener);

    applyCountingLines(settingsStore, settingsStore.getState().countingLines);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("applyNumberSetting", () => {
  it("キーごとの範囲に丸める", () => {
    const { settingsStore } = createDetectionStores();

    applyNumberSetting(settingsStore, "confidenceThreshold", 0);
    applyNumberSetting(settingsStore, "detectionInterval", 5000);

    expect(settingsStore.getState().confidenceThreshold).toBe(0.05);
    expect(settingsStore.getState().detectionInterval).toBe(1000);
  });

  it("丸めた結果が同じ値なら通知しない", () => {
    const { settingsStore } = createDetectionStores();
    const listener = vi.fn();
    settingsStore.subscribe(listener);

    applyNumberSetting(settingsStore, "detectionInterval", 100.4);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("applySettings", () => {
  it("すべての値を丸めて 1 度の通知で反映する", () => {
    const { settingsStore } = createDetectionStores();
    const listener = vi.fn();
    settingsStore.subscribe(listener);

    applySettings(settingsStore, {
      confidenceThreshold: 2,
      trackingDistanceThreshold: 0,
      detectionInterval: 5000,
      countingLines: [
        { id: "line-9", p1: { x: -1, y: 0.5 }, p2: { x: 2, y: 0.5 } },
      ],
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(settingsStore.getState()).toEqual({
      confidenceThreshold: 1,
      trackingDistanceThreshold: 0.1,
      detectionInterval: 1000,
      countingLines: [
        { id: "line-9", p1: { x: 0, y: 0.5 }, p2: { x: 1, y: 0.5 } },
      ],
    });
  });

  it("丸めた結果が同じなら通知しない", () => {
    const { settingsStore } = createDetectionStores();
    const listener = vi.fn();
    settingsStore.subscribe(listener);

    applySettings(settingsStore, INITIAL_SETTINGS);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("parseDetectionSettings", () => {
  const valid: DetectionSettings = {
    confidenceThreshold: 0.2,
    trackingDistanceThreshold: 0.7,
    detectionInterval: 120,
    countingLines: [
      { id: "line-1", p1: { x: 0, y: 0.6 }, p2: { x: 1, y: 0.6 } },
    ],
  };

  it("形が合っていれば通す", () => {
    expect(parseDetectionSettings(structuredClone(valid))).toEqual(valid);
  });

  it("余計なキーは落とす", () => {
    const parsed = parseDetectionSettings({
      ...structuredClone(valid),
      injected: "x",
      countingLines: [{ ...valid.countingLines[0], injected: "x" }],
    });

    expect(parsed).toEqual(valid);
  });

  it.each([
    ["数値でない設定", { ...valid, confidenceThreshold: "0.2" }],
    ["ラインが配列でない", { ...valid, countingLines: {} }],
    ["ラインが空", { ...valid, countingLines: [] }],
    [
      "座標が欠けたライン",
      { ...valid, countingLines: [{ id: "line-1", p1: { x: 0 }, p2: {} }] },
    ],
    ["オブジェクトでない", "settings"],
    ["null", null],
  ])("%s は弾く", (_label, value) => {
    expect(parseDetectionSettings(value)).toBeNull();
  });
});

describe("applyLineCounts", () => {
  it("通過数が変わったときだけ通知する", () => {
    const { resultStore } = createDetectionStores();
    const listener = vi.fn();
    resultStore.subscribe(listener);

    applyLineCounts(resultStore, { "line-1": { forward: 0, backward: 0 } });
    expect(listener).not.toHaveBeenCalled();

    applyLineCounts(resultStore, { "line-1": { forward: 1, backward: 0 } });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ラインが増減したら通知する", () => {
    const { resultStore } = createDetectionStores();
    const listener = vi.fn();
    resultStore.subscribe(listener);

    applyLineCounts(resultStore, {
      "line-1": { forward: 0, backward: 0 },
      "line-2": { forward: 0, backward: 0 },
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("applyMetrics", () => {
  it("同じ値なら通知せず，通過数の参照も保つ", () => {
    const { resultStore } = createDetectionStores();
    const before = resultStore.getState();
    const listener = vi.fn();
    resultStore.subscribe(listener);

    applyMetrics(resultStore, { trackedCount: 0, fps: 0 });
    expect(listener).not.toHaveBeenCalled();

    applyMetrics(resultStore, { trackedCount: 3, fps: 12.5 });
    expect(listener).toHaveBeenCalledTimes(1);
    // 通過数を購読している側が再レンダリングされないよう参照は据え置き
    expect(resultStore.getState().lineCounts).toBe(before.lineCounts);
  });
});

describe("画面操作の状態", () => {
  it("選択中のラインが同じなら通知しない", () => {
    const { viewStateStore } = createDetectionStores();
    const listener = vi.fn();
    viewStateStore.subscribe(listener);

    selectLine(viewStateStore, viewStateStore.getState().selectedLineId);
    expect(listener).not.toHaveBeenCalled();

    selectLine(viewStateStore, "line-2");
    expect(viewStateStore.getState().selectedLineId).toBe("line-2");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ライン生成モードを切り替える", () => {
    const { viewStateStore } = createDetectionStores();

    toggleLineCreationMode(viewStateStore);
    expect(viewStateStore.getState().lineCreationMode).toBe(true);

    toggleLineCreationMode(viewStateStore);
    expect(viewStateStore.getState().lineCreationMode).toBe(false);
  });
});
