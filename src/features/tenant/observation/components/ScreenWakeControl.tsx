"use client";

import { MonitorCheck, MonitorOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Toggle } from "@/components/ui/toggle";
import { useScreenWake } from "./ScreenWakeProvider";

export function ScreenWakeControl() {
  const { isSupported, enabled, errorKey, enable, disable } = useScreenWake();
  const t = useTranslations("Observation.screenWake");

  if (!isSupported) {
    return (
      <p className="text-center text-sm text-muted-foreground" role="note">
        {t("unsupported")}
      </p>
    );
  }

  // Screen Wake Lock はユーザー操作起点でのみ取得
  const handleChange = (next: boolean) => {
    if (next) {
      void enable();
    } else {
      void disable();
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <Toggle
        variant="outline"
        size="lg"
        isSelected={enabled}
        onChange={handleChange}
        aria-label={t("label")}
        className="selected:border-primary selected:bg-primary selected:text-primary-foreground border-2 px-6 text-base font-semibold shadow-sm"
      >
        {enabled ? (
          <MonitorCheck className="mr-2 size-5" aria-hidden="true" />
        ) : (
          <MonitorOff className="mr-2 size-5" aria-hidden="true" />
        )}
        {t("toggle", { state: enabled ? t("on") : t("off") })}
      </Toggle>
      {errorKey !== null ? (
        <p className="text-xs text-destructive" role="alert">
          {t(errorKey)}
        </p>
      ) : (
        <p
          className={
            enabled
              ? "text-sm text-muted-foreground"
              : "text-sm font-medium text-destructive"
          }
        >
          {enabled ? t("enabledHint") : t("disabledHint")}
        </p>
      )}
    </div>
  );
}
