"use client";

import { MonitorCheck, MonitorOff } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { useScreenWake } from "./ScreenWakeProvider";

export function ScreenWakeControl() {
  const { isSupported, enabled, error, enable, disable } = useScreenWake();

  if (!isSupported) {
    return (
      <p className="text-center text-muted-foreground text-sm" role="note">
        このブラウザは画面の常時点灯（Screen Wake
        Lock）に対応していません。端末側の自動消灯設定をご確認ください。
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
        aria-label="画面の常時点灯"
        className="border-2 selected:border-primary selected:bg-primary px-6 font-semibold selected:text-primary-foreground text-base shadow-sm"
      >
        {enabled ? (
          <MonitorCheck className="mr-2 size-5" aria-hidden="true" />
        ) : (
          <MonitorOff className="mr-2 size-5" aria-hidden="true" />
        )}
        画面の常時点灯: {enabled ? "ON" : "OFF"}
      </Toggle>
      <p
        className={
          enabled
            ? "text-muted-foreground text-sm"
            : "font-medium text-destructive text-sm"
        }
      >
        {enabled
          ? "観測中は画面が自動で消灯しません"
          : "観測中に画面が消灯し、観測が中断される可能性があります。タップして ON にしてください"}
      </p>
      {error !== null && (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
