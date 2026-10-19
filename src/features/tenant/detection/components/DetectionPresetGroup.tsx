import { memo, useCallback, useId } from "react";
import { useStore } from "zustand";
import { Toggle, ToggleButtonGroup } from "@/components/ui/toggle";
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
  const titleId = useId();
  const selectedIndex = presets.findIndex((preset) =>
    isSameNumberSetting(value, preset.value),
  );

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span id={titleId} className="font-medium">
          {title}
        </span>
        <span className="text-muted-foreground">{formatValue(value)}</span>
      </div>
      <ToggleButtonGroup
        aria-labelledby={titleId}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={selectedIndex === -1 ? [] : [String(selectedIndex)]}
        onSelectionChange={(keys) => {
          const preset = presets[Number([...keys][0])];
          if (preset) {
            applyNumberSetting(settingsStore, settingKey, preset.value);
          }
        }}
        className="flex-wrap justify-start gap-2"
      >
        {presets.map((preset, index) => (
          <Toggle
            key={`${settingKey}-${preset.value}`}
            id={String(index)}
            variant="outline"
            size="sm"
            className="selected:border-primary selected:bg-primary px-3 selected:text-primary-foreground"
          >
            {preset.label}
          </Toggle>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}

export const DetectionPresetGroup = memo(DetectionPresetGroupComponent);
