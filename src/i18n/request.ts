import { headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { resolveLocaleFromAcceptLanguage } from "./locale";

export default getRequestConfig(async () => {
  // ブラウザの言語設定（Accept-Language）を既定のロケールとして採用する。
  // ユーザーによる明示的な言語選択は後続ステップで上書きする想定。
  const requestHeaders = await headers();
  const locale = resolveLocaleFromAcceptLanguage(
    requestHeaders.get("accept-language"),
  );

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
