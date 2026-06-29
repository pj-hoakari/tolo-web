"use client";

import { useLanguage } from "@/features/guest/i18n/LanguageProvider";
import { LanguageSwitcher } from "@/features/guest/i18n/LanguageSwitcher";
import { messages } from "@/features/guest/i18n/messages";
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
  const { lang } = useLanguage();
  const t = messages[lang];

  return (
    <header className="border-b border-guest-primary/12 bg-guest-secondary">
      <div className="mx-auto flex w-full max-w-md items-start justify-between px-4 py-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-guest-primary/55">
            {t.pageSubtitle}
          </p>
          <h1 className="text-xl font-bold text-guest-primary">{tenantName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <StaffMessageBell tenantId={tenantId} eventId={eventId} />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
