"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME } from "./cookie";
import { isLocale, type Locale } from "./locale";

/**
 * ユーザーが選んだロケールを Cookie に保存する。
 * Cookie は host-only（domain 未指定）なので、テナントのサブドメインごとに独立して保持される。
 */
export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}
