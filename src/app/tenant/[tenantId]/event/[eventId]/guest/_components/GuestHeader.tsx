"use client";

import { ThemeToggle } from "@/components/theme-toggle";
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
    <header className="border-primary/12 border-b bg-secondary">
      <div className="mx-auto flex w-full max-w-md items-start justify-between px-4 py-4">
        <div>
          <p className="font-medium text-primary/55 text-xs tracking-wide">
            {t.pageSubtitle}
          </p>
          <h1 className="font-bold text-primary text-xl">{tenantName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <StaffMessageBell tenantId={tenantId} eventId={eventId} />
          <LanguageSwitcher />
          <ThemeToggle className="bg-secondary" />
        </div>
      </div>
    </header>
  );
}
