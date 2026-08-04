"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import type { Selection } from "react-aria-components";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopover, MenuTrigger } from "@/components/ui/menu";

const THEME_IDS = ["light", "dark", "system"] as const;

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("Theme");

  const handleSelectionChange = (keys: Selection) => {
    if (keys === "all") {
      return;
    }
    const next = [...keys][0];
    if (typeof next === "string") {
      setTheme(next);
    }
  };

  return (
    <MenuTrigger>
      <Button
        variant="outline"
        size="icon"
        aria-label={t("label")}
        className={className}
      >
        <Sun className="size-5 dark:hidden" aria-hidden />
        <Moon className="hidden size-5 dark:block" aria-hidden />
      </Button>
      <MenuPopover placement="bottom end">
        <Menu
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={theme ? [theme] : []}
          onSelectionChange={handleSelectionChange}
        >
          {THEME_IDS.map((id) => (
            <MenuItem key={id} id={id}>
              {t(id)}
            </MenuItem>
          ))}
        </Menu>
      </MenuPopover>
    </MenuTrigger>
  );
}
