"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import type { Lang } from "./messages";

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
  defaultLang = "ja",
}: {
  children: ReactNode;
  defaultLang?: Lang;
}) {
  const [lang, setLang] = useState<Lang>(defaultLang);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (context === null) {
    throw new Error("useLanguage は LanguageProvider の内側で使用してください");
  }
  return context;
}
