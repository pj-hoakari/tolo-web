// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  applySettings,
  createDetectionSettingsStore,
  INITIAL_SETTINGS,
} from "@/features/tenant/detection/stores/detectionStore";
import { persistDetectionSettings } from "./persistedDetectionSettings";

const KEY = "tolo:observation-detection-settings:test:8c1f0e2a5d4b3c6e:local";

const entrance = {
  ...INITIAL_SETTINGS,
  countingLines: [
    {
      id: "line-entrance",
      name: "入口",
      p1: { x: 0.2, y: 0.3 },
      p2: { x: 0.8, y: 0.4 },
      areaWidth: 0.2,
    },
  ],
};

beforeEach(() => localStorage.clear());

describe("persistDetectionSettings", () => {
  it("再読み込みの後の新しいストアに、前に設定したラインを戻す", () => {
    const before = createDetectionSettingsStore();
    const stop = persistDetectionSettings(before, KEY);
    applySettings(before, entrance);
    stop();

    const after = createDetectionSettingsStore();
    persistDetectionSettings(after, KEY);

    expect(after.getState().countingLines).toEqual(entrance.countingLines);
  });

  it("保存がなければ既定の設定のまま", () => {
    const store = createDetectionSettingsStore();
    persistDetectionSettings(store, KEY);

    expect(store.getState()).toEqual(INITIAL_SETTINGS);
  });

  it("壊れた保存は無視して既定の設定のまま", () => {
    localStorage.setItem(KEY, "{");
    const store = createDetectionSettingsStore();
    persistDetectionSettings(store, KEY);

    expect(store.getState()).toEqual(INITIAL_SETTINGS);
  });

  it("端末ごとに別々に保存する", () => {
    const store = createDetectionSettingsStore();
    persistDetectionSettings(store, KEY);
    applySettings(store, entrance);

    const other = createDetectionSettingsStore();
    persistDetectionSettings(other, `${KEY}-other`);

    expect(other.getState()).toEqual(INITIAL_SETTINGS);
  });
});
