"use client";

import { Toggle, ToggleButtonGroup } from "@/components/ui/toggle";
import { useLanguage } from "./LanguageProvider";
import { LANGS, type Lang } from "./messages";

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
      className="gap-1 rounded-full border border-guest-line bg-guest-surface p-1"
    >
      {LANGS.map(({ code, label }) => (
        <Toggle
          key={code}
          id={code}
          size="sm"
          className="h-auto rounded-full selected:bg-guest-accent px-2.5 py-1 font-medium selected:font-bold selected:text-guest-surface text-guest-ink-muted text-xs hover:bg-transparent hover:text-guest-accent"
        >
          {label}
        </Toggle>
      ))}
    </ToggleButtonGroup>
  );
}
