import type { Messages } from "next-intl";
import en from "../messages/en.json";
import es from "../messages/es.json";
import ja from "../messages/ja.json";
import ko from "../messages/ko.json";
import ne from "../messages/ne.json";
import zhHans from "../messages/zh-Hans.json";
import zhHant from "../messages/zh-Hant.json";
import type { Locale } from "../src/i18n/locale";

/**
 * Storybook 用にすべてのロケールのメッセージを静的に読み込む。
 * アプリ本体は request.ts で必要なロケールのみ動的 import するので、この定義は Storybook 専用。
 *
 * `satisfies Record<Locale, Messages>` により
 * - ロケールを増やしたときの追加漏れ
 * - 各ロケール JSON が基準（messages/ja.json）と違う形になっていること
 * を `pnpm typecheck` で検出できる。全ロケールを一度に読む唯一の場所なので、ここで検証している。
 */
export const storyMessages = {
  ja,
  en,
  ko,
  "zh-Hans": zhHans,
  "zh-Hant": zhHant,
  es,
  ne,
} satisfies Record<Locale, Messages>;
