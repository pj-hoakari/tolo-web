import { useTranslations } from "next-intl";
import { memo, useCallback, useState } from "react";
import { useStore } from "zustand";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { Input, TextField } from "@/components/ui/textfield";
import {
  applyNumberSetting,
  type DetectionSettings,
  type DetectionSettingsStore,
  type NumberSettingKey,
} from "../stores/detectionStore";

type DetectionNumberFieldProps = {
  label: string;
  settingKey: NumberSettingKey;
  min: number;
  max: number;
  step: number;
  settingsStore: DetectionSettingsStore;
};

function DetectionNumberFieldComponent({
  label,
  settingKey,
  min,
  max,
  step,
  settingsStore,
}: DetectionNumberFieldProps) {
  const selectValue = useCallback(
    (state: DetectionSettings) => state[settingKey],
    [settingKey],
  );
  const value = useStore(settingsStore, selectValue);

  return (
    <TextField className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) =>
          applyNumberSetting(
            settingsStore,
            settingKey,
            Number(event.currentTarget.value),
          )
        }
      />
    </TextField>
  );
}

const DetectionNumberField = memo(DetectionNumberFieldComponent);

export type DetectionAdvancedSettingsProps = {
  settingsStore: DetectionSettingsStore;
};

/**
 * プリセットでは選べない値を直接入力する詳細設定
 */
function DetectionAdvancedSettingsComponent({
  settingsStore,
}: DetectionAdvancedSettingsProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("Detection");

  return (
    <>
      <div className="sm:col-span-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onPress={() => setOpen((current) => !current)}
        >
          {open ? t("advanced.close") : t("advanced.open")}
        </Button>
      </div>
      {open && (
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
          <DetectionNumberField
            label={t("fields.confidence")}
            settingKey="confidenceThreshold"
            min={0.05}
            max={1}
            step={0.01}
            settingsStore={settingsStore}
          />
          <DetectionNumberField
            label={t("fields.tracking")}
            settingKey="trackingDistanceThreshold"
            min={0.1}
            max={1}
            step={0.01}
            settingsStore={settingsStore}
          />
          <DetectionNumberField
            label={t("fields.interval")}
            settingKey="detectionInterval"
            min={0}
            max={1000}
            step={10}
            settingsStore={settingsStore}
          />
        </div>
      )}
    </>
  );
}

export const DetectionAdvancedSettings = memo(
  DetectionAdvancedSettingsComponent,
);
