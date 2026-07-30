import { memo } from "react";
import type {
  DetectionSettingsStore,
  DetectionViewStateStore,
} from "../stores/detectionStore";
import { DetectionAdvancedSettings } from "./DetectionAdvancedSettings";
import { DetectionLineActions } from "./DetectionLineActions";
import {
  DetectionPresetGroup,
  type NumberSettingPreset,
} from "./DetectionPresetGroup";

const CONFIDENCE_PRESETS: NumberSettingPreset[] = [
  { label: "広め", value: 0.1 },
  { label: "標準", value: 0.15 },
  { label: "厳しめ", value: 0.3 },
];

const TRACKING_PRESETS: NumberSettingPreset[] = [
  { label: "安定", value: 0.6 },
  { label: "標準", value: 0.8 },
  { label: "追従優先", value: 0.95 },
];

const DETECTION_INTERVAL_PRESETS: NumberSettingPreset[] = [
  { label: "高頻度", value: 50 },
  { label: "標準", value: 100 },
  { label: "省負荷", value: 250 },
];

const formatThreshold = (value: number) => value.toFixed(2);
const formatMilliseconds = (value: number) => `${value}ms`;

export type DetectionSettingsPanelProps = {
  settingsStore: DetectionSettingsStore;
  viewStateStore: DetectionViewStateStore;
};

/**
 * 検出設定
 */
function DetectionSettingsPanelComponent({
  settingsStore,
  viewStateStore,
}: DetectionSettingsPanelProps) {
  return (
    <section className="grid w-full max-w-3xl gap-4 rounded border border-gray-200 p-4 sm:grid-cols-2">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
        <h3 className="font-bold">検出設定</h3>
        <DetectionLineActions
          settingsStore={settingsStore}
          viewStateStore={viewStateStore}
        />
      </div>
      <DetectionPresetGroup
        title="検出感度"
        settingKey="confidenceThreshold"
        presets={CONFIDENCE_PRESETS}
        formatValue={formatThreshold}
        settingsStore={settingsStore}
      />
      <DetectionPresetGroup
        title="追跡のつながりやすさ"
        settingKey="trackingDistanceThreshold"
        presets={TRACKING_PRESETS}
        formatValue={formatThreshold}
        settingsStore={settingsStore}
      />
      <DetectionPresetGroup
        title="検出頻度"
        settingKey="detectionInterval"
        presets={DETECTION_INTERVAL_PRESETS}
        formatValue={formatMilliseconds}
        settingsStore={settingsStore}
      />
      <DetectionAdvancedSettings settingsStore={settingsStore} />
    </section>
  );
}

export const DetectionSettingsPanel = memo(DetectionSettingsPanelComponent);
