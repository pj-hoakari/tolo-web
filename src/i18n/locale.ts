/** アプリがサポートするロケール一覧（messages/<locale>.json と対応する） */
export const locales = [
  "ja",
  "en",
  "ko",
  "zh-Hans",
  "zh-Hant",
  "es",
  "ne",
] as const;

export type Locale = (typeof locales)[number];

/** どのロケールにも一致しなかった場合に使うロケール */
export const defaultLocale: Locale = "ja";

/**
 * 言語セレクタに表示する名称。
 * 探している言語を見つけやすいよう、UI のロケールに関わらず各言語の自称表記で固定する。
 */
export const localeLabels: Record<Locale, string> = {
  ja: "日本語",
  en: "English",
  ko: "한국어",
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
  es: "Español",
  ne: "नेपाली",
};

const localeByLowerCase = new Map<string, Locale>(
  locales.map((locale) => [locale.toLowerCase(), locale]),
);

export function isLocale(value: string): value is Locale {
  return localeByLowerCase.get(value.toLowerCase()) === value;
}

/**
 * 言語サブタグだけが指定されたときに採用するロケール。
 * 中国語は表記体系が判別できないため、話者数の多い簡体字を既定とする。
 */
const localeByPrimarySubtag: Record<string, Locale> = {
  ja: "ja",
  en: "en",
  ko: "ko",
  zh: "zh-Hans",
  es: "es",
  ne: "ne",
};

/** 表記体系が明示されない中国語で、繁体字とみなす地域サブタグ */
const traditionalChineseRegions = new Set(["tw", "hk", "mo"]);

function matchChineseLocale(subtags: string[]): Locale {
  if (subtags.includes("hant")) {
    return "zh-Hant";
  }
  if (subtags.includes("hans")) {
    return "zh-Hans";
  }
  if (subtags.some((subtag) => traditionalChineseRegions.has(subtag))) {
    return "zh-Hant";
  }
  return "zh-Hans";
}

/** 小文字化済みの言語タグをサポート対象のロケールに対応付ける */
function matchLocale(tag: string): Locale | null {
  const exactMatch = localeByLowerCase.get(tag);
  if (exactMatch) {
    return exactMatch;
  }

  const [primarySubtag, ...subtags] = tag.split("-");
  if (primarySubtag === "zh") {
    return matchChineseLocale(subtags);
  }

  return localeByPrimarySubtag[primarySubtag] ?? null;
}

type LanguageRange = {
  /** 小文字化した言語タグ（例: "ja-jp"） */
  tag: string;
  quality: number;
  /** quality が同値だったときにヘッダーの記述順を保つための添字 */
  order: number;
};

function parseAcceptLanguage(header: string): LanguageRange[] {
  return header
    .split(",")
    .map((part, order): LanguageRange | null => {
      const [rawTag, ...params] = part.split(";");
      const tag = rawTag.trim().toLowerCase();
      if (!tag) {
        return null;
      }

      const qParam = params
        .map((param) => param.trim().toLowerCase())
        .find((param) => param.startsWith("q="));
      const quality = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
      if (!Number.isFinite(quality) || quality <= 0) {
        return null;
      }

      return { tag, quality, order };
    })
    .filter((range): range is LanguageRange => range !== null)
    .sort((a, b) => b.quality - a.quality || a.order - b.order);
}

/**
 * Accept-Language ヘッダーからサポート対象のロケールを選ぶ。
 * 完全一致（"zh-Hans"）だけでなく、地域や表記体系付きのタグ（"ja-JP" / "zh-Hant-TW" / "zh-TW"）も
 * 言語サブタグや表記体系から照合する。
 */
export function resolveLocaleFromAcceptLanguage(
  header: string | null | undefined,
): Locale {
  if (!header) {
    return defaultLocale;
  }

  for (const { tag } of parseAcceptLanguage(header)) {
    if (tag === "*") {
      return defaultLocale;
    }

    const matched = matchLocale(tag);
    if (matched) {
      return matched;
    }
  }

  return defaultLocale;
}
