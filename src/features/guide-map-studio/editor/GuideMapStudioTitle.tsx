"use client";

import { useI18n } from "./i18n";

// 案内マップ・スタジオのページの見出し（スタジオの文言の辞書を使うため、クライアントで出す）
export function GuideMapStudioTitle() {
  const { t } = useI18n();
  return <>{t("会場マップ・スタジオ")}</>;
}
