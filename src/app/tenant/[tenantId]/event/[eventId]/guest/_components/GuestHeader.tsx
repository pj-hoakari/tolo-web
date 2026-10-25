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
    <header className="border-b border-primary/12 bg-secondary">
      <div className="mx-auto flex w-full max-w-md items-start justify-between px-4 py-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-primary/55">
            {t("pageSubtitle")}
          </p>
          <h1 className="text-xl font-bold wrap-break-word text-primary">
            {tenantName}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
