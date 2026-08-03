import { describe, expect, test } from "vitest";
import {
  defaultLocale,
  isLocale,
  resolveLocaleFromAcceptLanguage,
} from "./locale";

describe("isLocale", () => {
  test("supported locale should be accepted", () => {
    expect(isLocale("zh-Hant")).toBe(true);
  });
  test("different casing should not be accepted", () => {
    expect(isLocale("zh-hant")).toBe(false);
  });
  test("unsupported locale should not be accepted", () => {
    expect(isLocale("fr")).toBe(false);
  });
});

describe("resolveLocaleFromAcceptLanguage", () => {
  test("exact match should be used as is", () => {
    expect(resolveLocaleFromAcceptLanguage("en")).toBe("en");
  });
  test("region subtag should fall back to the primary subtag", () => {
    expect(resolveLocaleFromAcceptLanguage("ja-JP")).toBe("ja");
  });
  test("korean should be supported", () => {
    expect(resolveLocaleFromAcceptLanguage("ko-KR")).toBe("ko");
  });
  test("spanish should be supported", () => {
    expect(resolveLocaleFromAcceptLanguage("es-MX")).toBe("es");
  });
  test("nepali should be supported", () => {
    expect(resolveLocaleFromAcceptLanguage("ne-NP")).toBe("ne");
  });
  test("script subtag should choose the chinese script", () => {
    expect(resolveLocaleFromAcceptLanguage("zh-Hant-TW")).toBe("zh-Hant");
    expect(resolveLocaleFromAcceptLanguage("zh-Hans-CN")).toBe("zh-Hans");
  });
  test("chinese script tag alone should match the locale exactly", () => {
    expect(resolveLocaleFromAcceptLanguage("zh-Hant")).toBe("zh-Hant");
  });
  test("traditional chinese regions should choose the traditional script", () => {
    expect(resolveLocaleFromAcceptLanguage("zh-TW")).toBe("zh-Hant");
    expect(resolveLocaleFromAcceptLanguage("zh-HK")).toBe("zh-Hant");
    expect(resolveLocaleFromAcceptLanguage("zh-MO")).toBe("zh-Hant");
  });
  test("other chinese regions should choose the simplified script", () => {
    expect(resolveLocaleFromAcceptLanguage("zh-CN")).toBe("zh-Hans");
    expect(resolveLocaleFromAcceptLanguage("zh-SG")).toBe("zh-Hans");
  });
  test("chinese without a script or region should choose the simplified script", () => {
    expect(resolveLocaleFromAcceptLanguage("zh")).toBe("zh-Hans");
  });
  test("script subtag should win over the region subtag", () => {
    expect(resolveLocaleFromAcceptLanguage("zh-Hans-HK")).toBe("zh-Hans");
  });
  test("higher quality value should win over the listed order", () => {
    expect(resolveLocaleFromAcceptLanguage("en;q=0.7,ko;q=0.9")).toBe("ko");
  });
  test("same quality value should keep the listed order", () => {
    expect(resolveLocaleFromAcceptLanguage("en;q=0.8,ko;q=0.8")).toBe("en");
  });
  test("quality value should default to 1", () => {
    expect(resolveLocaleFromAcceptLanguage("en,ja;q=0.9")).toBe("en");
  });
  test("unsupported locale should be skipped", () => {
    expect(resolveLocaleFromAcceptLanguage("fr-FR,de;q=0.8,en;q=0.5")).toBe(
      "en",
    );
  });
  test("q=0 should be ignored", () => {
    expect(resolveLocaleFromAcceptLanguage("en;q=0,es;q=0.1")).toBe("es");
  });
  test("wildcard should resolve to the default locale", () => {
    expect(resolveLocaleFromAcceptLanguage("fr,*;q=0.5,en;q=0.1")).toBe(
      defaultLocale,
    );
  });
  test("whitespace and casing should be normalized", () => {
    expect(resolveLocaleFromAcceptLanguage("  EN-GB ; Q=0.9 ")).toBe("en");
  });
  test("no supported locale should resolve to the default locale", () => {
    expect(resolveLocaleFromAcceptLanguage("fr-FR,de;q=0.8")).toBe(
      defaultLocale,
    );
  });
  test("missing header should resolve to the default locale", () => {
    expect(resolveLocaleFromAcceptLanguage(null)).toBe(defaultLocale);
  });
  test("empty header should resolve to the default locale", () => {
    expect(resolveLocaleFromAcceptLanguage("")).toBe(defaultLocale);
  });
});
