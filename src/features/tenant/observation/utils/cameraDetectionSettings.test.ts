import { describe, expect, it } from "vitest";
import {
  applyCountingLines,
  applyNumberSetting,
  createCameraDetectionStoreMaps,
  createDetectionStores,
} from "@/features/tenant/detection/stores/detectionStore";
import {
  selectCameraSettingsStore,
  selectCameraViewStateStore,
  toCameraDetectionOptions,
} from "./cameraDetectionSettings";

describe("toCameraDetectionOptions", () => {
  it("カメラごとの設定をそのカメラのフレームへ使う", () => {
    const { settingsStores } = createCameraDetectionStoreMaps([
      "camera-a",
      "camera-b",
    ]);
    const first = settingsStores.get("camera-a");
    const second = settingsStores.get("camera-b");
    if (!first || !second) {
      throw new Error("camera stores were not created");
    }

    applyCountingLines(first, [
      {
        id: "camera-a-line",
        name: "入口",
        areaWidth: 0.1,
        p1: { x: 0.1, y: 0.2 },
        p2: { x: 0.5, y: 0.6 },
      },
    ]);
    applyNumberSetting(first, "confidenceThreshold", 0.42);
    applyNumberSetting(first, "trackingDistanceThreshold", 0.33);
    applyCountingLines(second, [
      {
        id: "camera-b-line",
        name: "出口",
        areaWidth: 0.1,
        p1: { x: 0, y: 0.5 },
        p2: { x: 1, y: 0.5 },
      },
    ]);
    applyNumberSetting(second, "confidenceThreshold", 0.21);
    applyNumberSetting(second, "trackingDistanceThreshold", 0.66);

    const firstOptions = toCameraDetectionOptions(first.getState(), 1000, 500);
    const secondOptions = toCameraDetectionOptions(
      second.getState(),
      1000,
      500,
    );

    expect(firstOptions).toMatchObject({
      confidenceThreshold: 0.42,
      trackingDistanceThreshold: 0.33,
    });
    expect(firstOptions.countingLines).toEqual([
      {
        id: "camera-a-line",
        name: "入口",
        areaWidth: 50,
        p1: { x: 100, y: 100 },
        p2: { x: 500, y: 300 },
      },
    ]);
    expect(secondOptions).toMatchObject({
      confidenceThreshold: 0.21,
      trackingDistanceThreshold: 0.66,
    });
    expect(secondOptions.countingLines).toEqual([
      {
        id: "camera-b-line",
        name: "出口",
        areaWidth: 50,
        p1: { x: 0, y: 250 },
        p2: { x: 1000, y: 250 },
      },
    ]);
  });
});

describe("camera store selection", () => {
  it("カメラ用のストアがなければ共有ストアへフォールバックする", () => {
    const fallback = createDetectionStores();
    const { settingsStores, viewStateStores } = createCameraDetectionStoreMaps([
      "camera-a",
    ]);
    const cameraSettings = settingsStores.get("camera-a");
    const cameraViewState = viewStateStores.get("camera-a");
    if (!cameraSettings || !cameraViewState) {
      throw new Error("camera stores were not created");
    }

    expect(
      selectCameraSettingsStore(
        "camera-a",
        settingsStores,
        fallback.settingsStore,
      ),
    ).toBe(cameraSettings);
    expect(
      selectCameraSettingsStore(
        "local-camera",
        settingsStores,
        fallback.settingsStore,
      ),
    ).toBe(fallback.settingsStore);
    expect(
      selectCameraViewStateStore(
        "camera-a",
        viewStateStores,
        fallback.viewStateStore,
      ),
    ).toBe(cameraViewState);
    expect(
      selectCameraViewStateStore(
        null,
        viewStateStores,
        fallback.viewStateStore,
      ),
    ).toBe(fallback.viewStateStore);
  });
});
