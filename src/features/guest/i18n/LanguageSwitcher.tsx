"use client";

import { useLanguage } from "./LanguageProvider";
import { LANGS } from "./messages";

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex items-center gap-1 rounded-full border border-guest-line bg-guest-surface p-1">
      {LANGS.map(({ code, label }) => {
        const active = code === lang;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={active}
            onClick={() => setLang(code)}
            className={
              active
                ? "rounded-full bg-guest-accent px-2.5 py-1 text-xs font-bold text-guest-surface"
                : "rounded-full px-2.5 py-1 text-xs font-medium text-guest-ink-muted hover:text-guest-accent"
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
