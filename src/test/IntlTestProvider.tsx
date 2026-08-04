import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { defaultLocale } from "@/i18n/locale";
import messages from "../../messages/ja.json";

/**
 * ユニットテストで `useTranslations` を使うコンポーネントを描画するためのラッパー。
 * 既定ロケール（日本語）のメッセージを流し込むので、アサーションは日本語の文言で書ける。
 */
export function IntlTestProvider({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider
      locale={defaultLocale}
      messages={messages}
      // 日時フォーマットが実行環境のタイムゾーンで揺れないよう固定する
      timeZone="Asia/Tokyo"
    >
      {children}
    </NextIntlClientProvider>
  );
}
