import type { Preview } from "@storybook/nextjs-vite";
import { initialize, mswLoader } from "msw-storybook-addon";
import { handlers } from "../src/mocks/handlers";

// Storybook 起動時に MSW worker を初期化
// 宣言の無いリクエストはbypass
initialize({ onUnhandledRequest: "bypass" });

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

    // 既定で /rpc をモック
    // 各 Story は parameters.msw.handlers で上書き
    msw: { handlers },
  },
  loaders: [mswLoader],
};

export default preview;
