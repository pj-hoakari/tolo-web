import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  // tsconfig の paths と揃える（node 環境の unit プロジェクトでも `@/` を解決する）
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
    },
  },
  test: {
    browser: {
      // ブラウザセッションの接続待ちタイムアウト（既定 60s）。
      // Vitest はこの値をルートの設定からしか読まないので、storybook プロジェクト側
      // ではなくここに置く必要がある。
      // マシンが他の処理で混んでいるとブラウザの起動〜接続だけで既定値を超えることが
      // あるので余裕を持たせる（正常時の実行時間には影響しない）。
      connectTimeout: 120_000,
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          // MSW のモック API（/rpc）を node 環境で有効化
          setupFiles: ["./src/mocks/setup.ts"],
          // storybook プロジェクトより先に、単独で走らせる（storybook 側の
          // groupOrder のコメントを参照）
          sequence: {
            groupOrder: 0,
          },
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({ configDir: path.join(dirname, ".storybook") }),
        ],
        optimizeDeps: {
          include: ["msw-storybook-addon/preview"],
        },
        test: {
          name: "storybook",
          // タブごとに tester iframe を 1 つ作り、全 story ファイルで使い回す。
          isolate: false,
          // unit プロジェクトと同時に走らせない。
          // groupOrder が揃っている（既定は全プロジェクト 0）と、unit のワーカー
          // （既定 maxWorkers = CPU 数 - 1 = 23）と storybook のブラウザ起動が
          // 同時に走り、両者の transform とモジュール配信を 1 本の Vitest
          // メインスレッドが捌くことになる（Vitest がブラウザのタブ数を 12 で
          // 打ち止めにしているのも同じ理由）。
          // 直列化してもトータルの実行時間はほぼ変わらないので分けておく。
          sequence: {
            groupOrder: 1,
          },
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
