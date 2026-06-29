"use client";

import { Toggle, ToggleButtonGroup } from "@/components/ui/toggle";
import { useLanguage } from "./LanguageProvider";
import { type Lang, LANGS } from "./messages";

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <ToggleButtonGroup
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[lang]}
      onSelectionChange={(keys) => {
        const next = [...keys][0];
        if (next != null) setLang(next as Lang);
      }}
      aria-label="表示言語"
      className="gap-1 rounded-full border border-guest-primary/12 bg-guest-secondary p-1"
    >
      {LANGS.map(({ code, label }) => (
        <Toggle
          key={code}
          id={code}
          size="sm"
          className="h-auto rounded-full px-2.5 py-1 text-xs font-medium text-guest-primary/55 hover:bg-transparent hover:text-guest-accent selected:bg-guest-accent selected:font-bold selected:text-guest-secondary"
        >
          {label}
        </Toggle>
      ))}
    </ToggleButtonGroup>
  );
}
