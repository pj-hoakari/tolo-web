"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { LocaleSelectView } from "@/components/locale-select-view";
import { setLocale } from "@/i18n/actions";
import { defaultLocale, isLocale, type Locale } from "@/i18n/locale";

type LocaleSelectProps = {
  className?: string;
};

export function LocaleSelect({ className }: LocaleSelectProps) {
  const currentLocale = useLocale();
  const t = useTranslations("LocaleSelect");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSelect = (next: Locale) => {
    startTransition(async () => {
      await setLocale(next);
      // Cookie 更新後のロケールでサーバーコンポーネントを描画し直す
      router.refresh();
    });
  };

  return (
    <LocaleSelectView
      locale={isLocale(currentLocale) ? currentLocale : defaultLocale}
      onSelect={handleSelect}
      label={t("label")}
      isPending={isPending}
      className={className}
    />
  );
}
