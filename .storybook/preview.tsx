import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/nextjs-vite";
import { mswLoader } from "msw-storybook-addon/csf3";
import { NextIntlClientProvider } from "next-intl";
import {
  defaultLocale,
  isLocale,
  localeLabels,
  locales,
} from "../src/i18n/locale";
import { handlers } from "../src/mocks/handlers";
import { storyMessages } from "./messages";
// TailwindCSS を含むグローバルスタイルを Storybook に読み込む
import "../src/app/globals.css";
// ゲスト系ストーリー（Guest/*）を .guest-theme スコープ下で描画
import "../src/features/guest/guest-theme.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
  },
  globalTypes: {
    locale: {
      description: "next-intl のロケール",
      toolbar: {
        title: "Locale",
        icon: "globe",
        items: locales.map((locale) => ({
          value: locale,
          title: localeLabels[locale],
        })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    locale: defaultLocale,
  },
  decorators: [
    withThemeByClassName({
      themes: {
        light: "",
        dark: "dark",
      },
      defaultTheme: "light",
    }),
    // "Guest/*" のストーリーはゲストページと同じトークン再マッピング
    // .guest-theme 配下で描画
    (Story, { title }) =>
      title.startsWith("Guest/") ? (
        <div className="guest-theme">
          <Story />
        </div>
      ) : (
        <Story />
      ),
    // useTranslations / useFormatter を使うコンポーネントを描画できるようにする。
    // ロケールはツールバーの Locale から切り替えられる。
    (Story, { globals }) => {
      const locale =
        typeof globals.locale === "string" && isLocale(globals.locale)
          ? globals.locale
          : defaultLocale;

      return (
        <NextIntlClientProvider
          locale={locale}
          messages={storyMessages[locale]}
          // 日時フォーマットが実行環境のタイムゾーンで揺れないよう固定する
          timeZone="Asia/Tokyo"
        >
          <Story />
        </NextIntlClientProvider>
      );
    },
  ],
  loaders: [mswLoader()],
  // 既定で /rpc をモック
  beforeEach({ msw }) {
    msw.use(...handlers);
  },
};

export default preview;
