# PWA再実装の検証結果

基点: `develop` / `17bcb1484b108af8449003dba6caa9490105196b`。ブランチ: `feature/pwa-audit-improvement`。

**更新済みNPM_TOKENで依存同期が成功。現在の実装を維持したまま、単体・Storybook・全E2E・型・変更箇所のLint・本番ビルドが通過した。実機・実IdPは未検証。**

以下の表は元のPWA実装コミット `871954eb97ee140d5cf8dad6b2c5cfa1eb6b628f` 時点の実測。develop取り込み後の最新結果は末尾の「develop取り込み後の再検証」に記載する。

## 実測結果

| 項目                        | 状態                 | 証拠・結果                                                                                                  |
| --------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| 固定依存の同期              | 成功                 | GitHub Packages HTTP 200。pnpm12.18.0 `install --frozen-lockfile`、23.4秒。package.json/lockfileの変更なし  |
| 単体テスト                  | 成功                 | 138ファイル、1,259件成功・6件既存skip、失敗0                                                                |
| Storybook                   | 成功                 | 32ファイル、136件成功、skip/失敗0。単体と合わせ170ファイル・1,395件成功、71.66秒                            |
| E2E                         | 成功                 | 25ファイル・408件成功、skip/失敗/flaky0、232.73秒（CLI表示3.9分）                                           |
| TypeScript                  | 成功                 | `tsc --noEmit`、exit 0                                                                                      |
| 変更箇所のBiome             | 成功                 | 今回の46ファイル。無関係な一括整形なし                                                                      |
| 全体Lint（整形を除く）      | 成功                 | `biome check --formatter-enabled=false`、既存警告2件のみ                                                    |
| 全体Biome（整形込み）       | 既存差分で失敗       | 基点637件→605件の整形エラー。基点との比較で新規診断0。下記参照                                              |
| 本番ビルド                  | 成功                 | Next.js16.4.6。API/CROWD/AUTH/TENANTの全モックをdisabledにしてbuild・型検査・ページ生成まで成功             |
| Manifest                    | 成功                 | staff id/start_url、guest legacy分岐不変、PNG寸法、HTTP no-storeを単体/E2Eで確認                            |
| Service Worker / キャッシュ | 成功                 | 本番SW追加なし。E2Eの登録workerは既存MSWのみ、Cache Storageは空。保護HTML6画面のno-store確認                |
| オフラインと復旧            | 成功                 | Android相当/通常/standaloneで操作と古い表示を外し、再接続後の再読込を確認。案内マップの保存停止・復旧も確認 |
| 認証・権限回帰              | 成功（自動試験範囲） | 匿名/machineの拒否、CSRF、認証復帰、保存所有者分離と再マウント、別アカウント/legacy記録非表示               |
| ゲストへの影響              | 成功（自動試験範囲） | guest関連ファイル差分0、既存guest E2Eとguest Storybookを含め成功                                            |
| 既存文言                    | 成功                 | 7言語のHEAD比較でStaffConnection以外は不変                                                                  |
| Git差分                     | 成功                 | `git diff --check`、対象46ファイルのみ。認証設定・依存定義・lockfile・server認可の変更なし                  |

## 前回件数との比較

| 対象          | 前回       | 今回  | 増減・理由                                                                                                         |
| ------------- | ---------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| 単体成功      | 1,182      | 1,259 | +77。最新developの案内マップ・観測・認証等の試験追加と、今回の保存分離・所有者再マウント・案内マップ匿名拒否の追加 |
| 単体skip      | 6          | 6     | 変更なし。下記PostgreSQL6件のみ                                                                                    |
| Storybook成功 | 前回未実施 | 136   | 今回はCIと同じtest:all相当を実行                                                                                   |
| E2E成功       | 397        | 408   | +11。最新developで案内マップ6件・観測3件が増加し、今回PWAの案内マップ切断と他アカウント記録非表示を2件追加         |

前回の結果を転用せず、今回の固定依存とコードで全件を実行した。新しいskip、テストの削除、リトライによる失敗隠しはない。今回の再開では実装コードの変更・破棄、ブランチ切替、develop再取得を行っていない。

## スキップ項目

`AUTH_TEST_DATABASE_URL` が未設定の場合、既存PostgreSQL統合試験6件が `describe.skipIf` でスキップされる。実行JSONでもこの6件だけがskipであることを確認した。

| ファイル                             | 件数 | 内容                                                                            |
| ------------------------------------ | ---- | ------------------------------------------------------------------------------- |
| `src/server/auth/login.test.ts`      | 3    | logout時のtoken行削除、ログイン引渡しの一回性、registration token引渡しの一回性 |
| `src/server/auth/onboarding.test.ts` | 1    | 仮テナントの保存・再利用                                                        |
| `src/server/auth/session.test.ts`    | 2    | 複数インスタンスの同時refresh、DB経由でのevent token再利用                      |

schema作成/削除を伴うため、専用の検証DBがない状態で本番DBへ実行しない。DB変更は行っていない。

## 整形エラーの切り分け

PWA適用前の最新developをBiome2.6.7のJSON reporterで測定: 整形エラー637件、既存警告2件（`src/server/auth/login.test.ts` の未使用import/関数）。CRLFチェックアウトとformatterのLF既定値による既存差分を含む。

変更ファイルだけを整形し、全体は整形エラー605件・既存警告2件。基点の診断とカテゴリ・パス・メッセージで比較し、新規診断は0。無関係なファイルに `--write` をかけていない。このため全体の整形込み `pnpm check` だけは未通過であり、成功扱いにしない。

## 実行環境・コマンド

Windows / Node v26.13.1 / pnpm12.18.0 / Vitest5.1.0 / Playwright1.65.0 / Chromium158.0.8127.18 / Biome2.6.7 / Next.js16.4.6。

```text
pnpm install --frozen-lockfile
node node_modules/vitest/vitest.mjs run --maxWorkers=4 --reporter=default --reporter=json --outputFile=node_modules/.cache/pwa-final-vitest.json
node node_modules/playwright/cli.js test --workers=2 --reporter=list,json
node node_modules/typescript/bin/tsc --noEmit
node node_modules/@biomejs/biome/bin/biome check <今回の46ファイル>
node node_modules/@biomejs/biome/bin/biome check --formatter-enabled=false
pnpm build
git diff --check
```

- インストールは更新されたローカル `.env` のNPM_TOKENを使用。値は表示せず、環境変数参照だけの一時userconfigで渡し、グローバル設定・.envを変更しない。
- 古いランチャーを避ける検証専用pnpm wrapperとNode26を各プロセスのPATHへ追加した。アプリの設定には加えていない。
- SWCキャッシュとブラウザ起動のためテストは通常権限で実行した。
- WindowsのNodeが `test.localhost` を解決できない既存問題には、E2Eプロセスのみ `NODE_OPTIONS=--require=.../node_modules/.cache/pwa-localhost.cjs` を設定。`dns.lookup` とPromise版の `*.localhost` をloopbackへ向ける補助で、hosts・本番DNS・アプリは変更しない。
- E2Eは既存のAUTH/API/CROWD/TENANTモックを使用。本番形式buildは別プロセスで全モックをdisabledにした。
- 生ログ/JSONはGit対象外の `node_modules/.cache/pwa-resume-install.log`、`pwa-final-vitest.{log,json}`、`pwa-final-vitest-summary.json`、`pwa-final-e2e.{log,json}`、`pwa-final-typecheck.log`、`pwa-final-lint.log`、`pwa-final-build.log`。整形基点と比較JSONも同ディレクトリに保存。

## 未検証・本番反映前の確認

Android Chrome実機、iOS Safari実機、OSへ実インストールしたPWA、実IdPでのアカウント切替、実機オフライン復旧は未検証。Android相当のUA/touch/390×844とstandalone表示の自動試験は成功したが、実機の合格へ置き換えない。

legacy id `/` の既存インストールは自動移行しない。所有者不明の旧下書き・計測記録も削除/自動移行せずブラウザ内へ残すため、リリース前に利用者への案内と復旧手順を決める。Push・PR・マージ・本番反映は今回の範囲外。

## develop取り込み後の再検証

対象develop: `512b6ea6b0de079e4b9732fb7923d919bee1dd7c`。解消方針はdevelopの名称・公開入口・ファイル分割を優先し、既存PWAの境界と保存分離を保持。

- 全単体・Storybook: 170ファイル、1,395件成功、既存PostgreSQL6件skip、失敗0（61.13秒）。内訳は単体1,259件・Storybook136件で前回から不変。
- TypeScript: `tsc --noEmit` 成功。
- 競合2ファイルと更新3資料のBiome: 成功。全体Lint（整形除外）も既存警告2件のみで成功。未解決競合0、developとのguest差分0。
- 案内マップ/PWA/guest/authの関連E2E76件: 全件成功（53.0秒、失敗/skip/flaky0）。全408件の再実行とは区別する。
- 非モック本番build: 成功。API/CROWD/AUTH/TENANTモックをdisabledにして型検査・ページ生成まで完了。
- 既存MSWの生成バージョン警告は出るが、全単体/Storybookは成功。workerを今回の競合解消で更新しない。

ログは `node_modules/.cache/pwa-merge-vitest.{log,json}`、`pwa-merge-typecheck.log`、`pwa-merge-e2e.{log,json}`、`pwa-merge-build.log`、`pwa-merge-lint.log` に保存。
