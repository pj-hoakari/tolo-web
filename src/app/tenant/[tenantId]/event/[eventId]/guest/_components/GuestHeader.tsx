"use client";

import { useTranslations } from "next-intl";
import { LocaleSelect } from "@/components/locale-select";
import { ThemeToggle } from "@/components/theme-toggle";
import { StaffMessageBell } from "@/features/guest/info/StaffMessageBell";

export type GuestHeaderProps = {
  tenantName: string;
  tenantId: string;
  eventId: string;
};

export function GuestHeader({
  tenantName,
  tenantId,
  eventId,
}: GuestHeaderProps) {
  const t = useTranslations("Guest");

  return (
    <header className="border-primary/12 border-b bg-secondary">
      <div className="mx-auto flex w-full max-w-md items-start justify-between px-4 py-4">
        <div>
          <p className="font-medium text-primary/55 text-xs tracking-wide">
            {t("pageSubtitle")}
          </p>
          <h1 className="font-bold text-primary text-xl">{tenantName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <StaffMessageBell tenantId={tenantId} eventId={eventId} />
          <LocaleSelect className="bg-secondary" />
          <ThemeToggle className="bg-secondary" />
        </div>
      </div>
    </header>
  );
}
