import type {
  DetectionSettings,
  DetectionSettingsStore,
  DetectionViewStateStore,
} from "@/features/tenant/detection/stores/detectionStore";
import {
  type DetectionOverlayLine,
  toOverlayCountingLines,
} from "@/features/tenant/webrtc/utils/detectionOverlay";
import type { CrowdDetectionOptions } from "./detectCrowd";

export type CameraDetectionOptions = Omit<
  CrowdDetectionOptions,
  "countingLines"
> & {
  countingLines: DetectionOverlayLine[];
};

/**
 * カメラに対応する設定ストアを返す。カメラ用のストアがない場合は
 * ローカルカメラ・開発用の共有ストアへフォールバックする。
 */
export function selectCameraSettingsStore(
  key: string | null | undefined,
  stores: ReadonlyMap<string, DetectionSettingsStore>,
  fallback: DetectionSettingsStore,
): DetectionSettingsStore {
  if (key === null || key === undefined) {
    return fallback;
  }
  return stores.get(key) ?? fallback;
}

export function selectCameraViewStateStore(
  key: string | null | undefined,
  stores: ReadonlyMap<string, DetectionViewStateStore>,
  fallback: DetectionViewStateStore,
): DetectionViewStateStore {
  if (key === null || key === undefined) {
    return fallback;
  }
  return stores.get(key) ?? fallback;
}

export function toCameraDetectionOptions(
  settings: DetectionSettings,
  width: number,
  height: number,
): CameraDetectionOptions {
  return {
    confidenceThreshold: settings.confidenceThreshold,
    trackingDistanceThreshold: settings.trackingDistanceThreshold,
    countingLines: toOverlayCountingLines(
      settings.countingLines,
      width,
      height,
    ),
  };
}
