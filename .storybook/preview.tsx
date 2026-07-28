import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/nextjs-vite";
import { mswLoader } from "msw-storybook-addon/csf3";
import { handlers } from "../src/mocks/handlers";
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
  ],
  loaders: [mswLoader()],
  // 既定で /rpc をモック
  beforeEach({ msw }) {
    msw.use(...handlers);
  },
};

export default preview;
