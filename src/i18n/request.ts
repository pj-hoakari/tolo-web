import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE_NAME } from "./cookie";
import { isLocale, resolveLocaleFromAcceptLanguage } from "./locale";

export default getRequestConfig(async () => {
  // ユーザーが明示的に選んだロケールを最優先し、無ければブラウザの言語設定にフォールバックする。
  const cookieStore = await cookies();
  const selectedLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  const locale =
    selectedLocale && isLocale(selectedLocale)
      ? selectedLocale
      : resolveLocaleFromAcceptLanguage(
          (await headers()).get("accept-language"),
        );

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
