"use client";

import { MonitorCheck, MonitorOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Toggle } from "@/components/ui/toggle";
import { useScreenWake } from "./ScreenWakeProvider";

export function ScreenWakeControl() {
  const { isSupported, enabled, error, enable, disable } = useScreenWake();
  const t = useTranslations("Observation.screenWake");

  if (!isSupported) {
    return (
      <p className="text-center text-muted-foreground text-sm" role="note">
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
        className="border-2 selected:border-primary selected:bg-primary px-6 font-semibold selected:text-primary-foreground text-base shadow-sm"
      >
        {enabled ? (
          <MonitorCheck className="mr-2 size-5" aria-hidden="true" />
        ) : (
          <MonitorOff className="mr-2 size-5" aria-hidden="true" />
        )}
        {t("toggle", { state: enabled ? t("on") : t("off") })}
      </Toggle>
      <p
        className={
          enabled
            ? "text-muted-foreground text-sm"
            : "font-medium text-destructive text-sm"
        }
      >
        {enabled ? t("enabledHint") : t("disabledHint")}
      </p>
      {error !== null && (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
