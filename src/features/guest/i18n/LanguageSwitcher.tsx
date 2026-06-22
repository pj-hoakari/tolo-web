"use client";

import { useLanguage } from "./LanguageProvider";
import { LANGS } from "./messages";

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
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
                ? "rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-surface"
                : "rounded-full px-2.5 py-1 text-xs font-medium text-ink-muted hover:text-accent"
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
