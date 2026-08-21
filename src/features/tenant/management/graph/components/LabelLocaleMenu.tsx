"use client";

import { Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Selection } from "react-aria-components";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopover, MenuTrigger } from "@/components/ui/menu";
import { isLocale, type Locale, localeLabels, locales } from "@/i18n/locale";

/** ラベル言語メニューに渡す props（エディタ・ビューアのツールバー共通） */
export type LabelLocaleBindings = {
  /** ポイントラベルの表示・編集対象の言語 */
  labelLocale: Locale;
  onChangeLabelLocale: (locale: Locale) => void;
  /** ロケールごとの、ラベルが設定済みのポイント数 */
  labelCounts: Record<string, number>;
  /** ポイント総数（ラベル設定状況の分母） */
  pointCount: number;
};

/**
 * ポイントラベルの表示・編集言語を切り替えるメニュー。
 * 各言語のラベル設定状況（設定済み数 / ポイント総数）を並記する。
 * UI の表示言語（LocaleSelect）とは独立して切り替えられる。
 */
export function LabelLocaleMenu({
  labelLocale,
  onChangeLabelLocale,
  labelCounts,
  pointCount,
}: LabelLocaleBindings) {
  const t = useTranslations("Graph.labelLanguage");

  const handleSelectionChange = (keys: Selection) => {
    if (keys === "all") return;
    const next = [...keys][0];
    if (typeof next !== "string" || !isLocale(next) || next === labelLocale) {
      return;
    }
    onChangeLabelLocale(next);
  };

  return (
    <MenuTrigger>
      <Button
        variant="outline"
        size="sm"
        aria-label={t("label")}
        className="gap-1.5"
      >
        <Languages aria-hidden className="size-4 shrink-0" />
        {localeLabels[labelLocale]}
      </Button>
      <MenuPopover placement="bottom end">
        <Menu
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[labelLocale]}
          onSelectionChange={handleSelectionChange}
        >
          {locales.map((item) => (
            <MenuItem key={item} id={item} textValue={localeLabels[item]}>
              <span className="flex w-full items-center justify-between gap-4">
                {localeLabels[item]}
                <span className="text-muted-foreground text-xs">
                  {t("labeledPointCount", {
                    count: labelCounts[item] ?? 0,
                    total: pointCount,
                  })}
                </span>
              </span>
            </MenuItem>
          ))}
        </Menu>
      </MenuPopover>
    </MenuTrigger>
  );
}
