import { useTranslations } from "next-intl";
import { memo } from "react";
import type {
  DetectionSettingsStore,
  DetectionViewStateStore,
} from "../stores/detectionStore";
import { DetectionAdvancedSettings } from "./DetectionAdvancedSettings";
import { DetectionLineActions } from "./DetectionLineActions";
import { DetectionPresetGroup } from "./DetectionPresetGroup";

/** プリセットの表示名は Detection.presets の下のキーで解決する */
type PresetDef = { labelKey: string; value: number };

const CONFIDENCE_PRESETS: PresetDef[] = [
  { labelKey: "wide", value: 0.1 },
  { labelKey: "standard", value: 0.15 },
  { labelKey: "strict", value: 0.3 },
];

const TRACKING_PRESETS: PresetDef[] = [
  { labelKey: "stable", value: 0.6 },
  { labelKey: "standard", value: 0.8 },
  { labelKey: "responsive", value: 0.95 },
];

const DETECTION_INTERVAL_PRESETS: PresetDef[] = [
  { labelKey: "frequent", value: 50 },
  { labelKey: "standard", value: 100 },
  { labelKey: "light", value: 250 },
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
  const t = useTranslations("Detection");

  const translatePresets = (presets: PresetDef[]) =>
    presets.map(({ labelKey, value }) => ({
      label: t(`presets.${labelKey}`),
      value,
    }));

  return (
    <section className="grid w-full max-w-3xl gap-4 rounded border border-gray-200 p-4 sm:grid-cols-2">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
        <h3 className="font-bold">{t("title")}</h3>
        <DetectionLineActions
          settingsStore={settingsStore}
          viewStateStore={viewStateStore}
        />
      </div>
      <DetectionPresetGroup
        title={t("fields.confidence")}
        settingKey="confidenceThreshold"
        presets={translatePresets(CONFIDENCE_PRESETS)}
        formatValue={formatThreshold}
        settingsStore={settingsStore}
      />
      <DetectionPresetGroup
        title={t("fields.tracking")}
        settingKey="trackingDistanceThreshold"
        presets={translatePresets(TRACKING_PRESETS)}
        formatValue={formatThreshold}
        settingsStore={settingsStore}
      />
      <DetectionPresetGroup
        title={t("fields.frequency")}
        settingKey="detectionInterval"
        presets={translatePresets(DETECTION_INTERVAL_PRESETS)}
        formatValue={formatMilliseconds}
        settingsStore={settingsStore}
      />
      <DetectionAdvancedSettings settingsStore={settingsStore} />
    </section>
  );
}

export const DetectionSettingsPanel = memo(DetectionSettingsPanelComponent);
