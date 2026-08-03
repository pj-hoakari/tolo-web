"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import type { Selection } from "react-aria-components";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopover, MenuTrigger } from "@/components/ui/menu";
import { setLocale } from "@/i18n/actions";
import { isLocale, localeLabels, locales } from "@/i18n/locale";

type LocaleSelectProps = {
  className?: string;
};

export function LocaleSelect({ className }: LocaleSelectProps) {
  const currentLocale = useLocale();
  const t = useTranslations("LocaleSelect");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSelectionChange = (keys: Selection) => {
    if (keys === "all") {
      return;
    }
    const next = [...keys][0];
    if (typeof next !== "string" || !isLocale(next) || next === currentLocale) {
      return;
    }

    startTransition(async () => {
      await setLocale(next);
      // Cookie 更新後のロケールでサーバーコンポーネントを描画し直す
      router.refresh();
    });
  };

  return (
    <MenuTrigger>
      <Button
        variant="outline"
        size="icon"
        aria-label={t("label")}
        isDisabled={isPending}
        className={className}
      >
        <Languages className="size-5" aria-hidden />
      </Button>
      <MenuPopover placement="bottom end">
        <Menu
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[currentLocale]}
          onSelectionChange={handleSelectionChange}
        >
          {locales.map((locale) => (
            <MenuItem key={locale} id={locale}>
              {localeLabels[locale]}
            </MenuItem>
          ))}
        </Menu>
      </MenuPopover>
    </MenuTrigger>
  );
}
