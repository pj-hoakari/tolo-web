import { memo, useCallback } from "react";
import { useStore } from "zustand";
import { Button } from "@/components/ui/button";
import {
  applyNumberSetting,
  type DetectionSettings,
  type DetectionSettingsStore,
  type NumberSettingKey,
} from "../stores/detectionStore";

export type NumberSettingPreset = {
  label: string;
  value: number;
};

function isSameNumberSetting(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

export type DetectionPresetGroupProps = {
  title: string;
  settingKey: NumberSettingKey;
  presets: NumberSettingPreset[];
  formatValue: (value: number) => string;
  settingsStore: DetectionSettingsStore;
};

function DetectionPresetGroupComponent({
  title,
  settingKey,
  presets,
  formatValue,
  settingsStore,
}: DetectionPresetGroupProps) {
  const selectValue = useCallback(
    (state: DetectionSettings) => state[settingKey],
    [settingKey],
  );
  const value = useStore(settingsStore, selectValue);

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{title}</span>
        <span className="text-gray-500">{formatValue(value)}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={`${settingKey}-${preset.value}`}
            type="button"
            variant={
              isSameNumberSetting(value, preset.value) ? "default" : "outline"
            }
            size="sm"
            onPress={() =>
              applyNumberSetting(settingsStore, settingKey, preset.value)
            }
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const DetectionPresetGroup = memo(DetectionPresetGroupComponent);
