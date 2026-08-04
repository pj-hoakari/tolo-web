import type { Locale } from "@/i18n/locale";
// 既定ロケール（日本語）のメッセージを型の基準にする。
// 他ロケールの JSON はこの形と揃っている必要がある（.storybook/messages.ts で検証）。
import type messages from "./messages/ja.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
