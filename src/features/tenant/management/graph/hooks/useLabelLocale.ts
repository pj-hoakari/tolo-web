"use client";

import { useLocale } from "next-intl";
import { useState } from "react";
import { defaultLocale, isLocale, type Locale } from "@/i18n/locale";

/**
 * ポイントラベルの表示・編集言語の状態。
 * 既定は UI の表示言語で、以後は UI 言語と独立して切り替えられる。
 */
export function useLabelLocale(): [Locale, (locale: Locale) => void] {
  const uiLocale = useLocale();
  const [labelLocale, setLabelLocale] = useState<Locale>(
    isLocale(uiLocale) ? uiLocale : defaultLocale,
  );
  return [labelLocale, setLabelLocale];
}
