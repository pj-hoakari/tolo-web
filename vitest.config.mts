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
        test: {
          name: "storybook",
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
            // タブごとに tester iframe を 1 つ作り、全 story ファイルで使い回す。
            //
            // 既定（true）は story ファイルごとに iframe を作り直す。すると
            // msw-storybook-addon の mswLoader がファイルごとに worker.start() を
            // 呼び直し、12 タブが共有する 1 つの Service Worker
            // （/mockServiceWorker.js）に対して client（iframe）が次々に
            // 入れ替わり続ける。Service Worker はページの fetch を全て
            // 横取りするので、client の入れ替わりに巻き込まれたモジュールの
            // import が返らなくなり、テスト全体がハングする
            // （story ファイルが "(0 test)" のまま止まる。--project storybook
            // 単独でも実測 8 回に 1 回。この経路にタイムアウトは無い）。
            // mswLoader を外すとハングは 10/10 で再現しなくなり、iframe を
            // 使い回す設定にしても同じくハングしなくなる。
            //
            // 副次的に setup（preview + Tailwind の読み込み）の回数が
            // 32 回から 12 回に減り、storybook プロジェクトの実行時間が半減する。
            //
            // 注意: story ファイル間で tester のモジュール状態が共有される。
            isolate: false,
          },
        },
      },
    ],
  },
});
