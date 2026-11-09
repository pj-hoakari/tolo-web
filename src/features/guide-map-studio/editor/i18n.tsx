"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import type { ConnectorType } from "@/features/guest/info/guideMapLayout";
import { EN } from "./i18nEn";

// 案内マップ・スタジオの文言。
//  - 文言は日本語の文そのものを見出しにして、日本語以外は i18nEn.ts の英語の辞書から引く（訳が無ければ日本語のまま）。
//  - お客さんの画面の案内マップと同じ文言（階段などの呼び名・道順の言い方など）は、messages の Guest.guideMap を使う（tg）。
//  - 画面の言語は tolo-web の言語選び（next-intl のロケール）に従う。
//  - lang はグラフの名前など、言語ごとの名前を選ぶのに使う（tolo-web のロケールそのまま）。
//  - 地図に入力した名前などのデータは訳さない。

type Vars = Record<string, string | number>;

const fill = (s: string, vars?: Vars) =>
  vars
    ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
    : s;

export function useI18n() {
  const lang = useLocale();
  const tg = useTranslations("Guest.guideMap");
  const t = React.useCallback(
    (ja: string, vars?: Vars) =>
      fill(lang === "ja" ? ja : (EN[ja] ?? ja), vars),
    [lang],
  );
  // 階段・エスカレーター・エレベーターの呼び名（お客さんの画面と同じ）
  const connectorName = React.useCallback(
    (ct: ConnectorType) => tg(`connectors.${ct}`),
    [tg],
  );
  return { lang, t, tg, connectorName };
}
