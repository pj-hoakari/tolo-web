"use client";

import { Languages } from "lucide-react";
import type { Selection } from "react-aria-components";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopover, MenuTrigger } from "@/components/ui/menu";
import { isLocale, type Locale, localeLabels, locales } from "@/i18n/locale";

export type LocaleSelectViewProps = {
  /** 現在選択中のロケール */
  locale: Locale;
  /** ロケール選択時のコールバック。現在と同じロケールを選んだときは呼ばれない */
  onSelect: (locale: Locale) => void;
  /** トリガーボタンの aria-label */
  label: string;
  /** 切替処理中はトリガーを無効化する */
  isPending?: boolean;
  className?: string;
};

export function LocaleSelectView({
  locale,
  onSelect,
  label,
  isPending = false,
  className,
}: LocaleSelectViewProps) {
  const handleSelectionChange = (keys: Selection) => {
    if (keys === "all") {
      return;
    }
    const next = [...keys][0];
    if (typeof next !== "string" || !isLocale(next) || next === locale) {
      return;
    }
    onSelect(next);
  };

  return (
    <MenuTrigger>
      <Button
        variant="outline"
        size="icon"
        aria-label={label}
        isDisabled={isPending}
        className={className}
      >
        <Languages className="size-5" aria-hidden />
      </Button>
      <MenuPopover placement="bottom end">
        <Menu
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[locale]}
          onSelectionChange={handleSelectionChange}
        >
          {locales.map((item) => (
            <MenuItem key={item} id={item}>
              {localeLabels[item]}
            </MenuItem>
          ))}
        </Menu>
      </MenuPopover>
    </MenuTrigger>
  );
}
