"use client";

import { useTranslations } from "next-intl";
import { LocaleSelect } from "@/components/locale-select";
import { PwaInstall } from "@/components/pwa/pwa-install";
import { ThemeToggle } from "@/components/theme-toggle";
import { StaffMessageBell } from "@/features/guest/info/StaffMessageBell";

export type GuestHeaderProps = {
  tenantName: string;
  tenantId: string;
  eventId: string;
  showStaffMessages: boolean;
};

export function GuestHeader({
  tenantName,
  tenantId,
  eventId,
  showStaffMessages,
}: GuestHeaderProps) {
  const t = useTranslations("Guest");

  return (
    <header className="border-primary/12 border-b bg-secondary">
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 py-3 sm:py-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-primary/55 text-xs tracking-wide">
            {t("pageSubtitle")}
          </p>
          {/* スマホでは右側のボタン群で幅が狭くなるため、長い名前は 2 行までで省略する */}
          <h1 className="wrap-break-word line-clamp-2 font-bold text-lg text-primary sm:text-xl">
            {tenantName}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <PwaInstall compact />
          {showStaffMessages && (
            <StaffMessageBell tenantId={tenantId} eventId={eventId} />
          )}
          <LocaleSelect className="bg-secondary" />
          <ThemeToggle className="bg-secondary" />
        </div>
      </div>
    </header>
  );
}
