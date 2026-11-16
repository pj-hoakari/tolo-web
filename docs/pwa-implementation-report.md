# PWA調査・改善の再実装報告

作業日: 2026-11-16。**更新済みNPM_TOKENで依存同期し、現在の実装を維持したままローカルの自動検証を完了した。単体1,259件・Storybook136件・E2E408件、型検査・変更箇所Lint・非モック本番buildが成功。実機/実IdPは未検証。**

## ブランチと退避

| 項目              | 値                                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 作業ブランチ      | `feature/pwa-audit-improvement`                                                                                                  |
| 基点develop SHA   | `17bcb1484b108af8449003dba6caa9490105196b`                                                                                       |
| 最終コミットSHA   | この報告書を含む最終コミットを `git log -1 --format=%H -- docs/pwa-implementation-report.md` で取得。実値は完了時の回答に記載    |
| 元ブランチ / HEAD | `refactor/event-management-ui` / `cb9bbf48ed2b9c832fad51eb8d807af2ee4cc3db`                                                      |
| 元の改善差分      | 未コミットのtracked 23ファイル、untracked 8ファイル。既存PWA導入コミットとは別の差分                                             |
| 退避先            | `C:/Users/yumak/.codex/visualizations/2026/11/16/01a1e2aa-8307-7290-8f12-feacab30e592/pwa-audit-backup-2026-11-16T05-35-09-564Z` |

退避物は `pwa-tracked.patch`（binary/full-index）、`files/`（全31ファイルの実バイト）、`metadata.json`（元HEAD・ブランチ・パス・SHA256）、`restore-verification/`、`restore-check.json`。別ディレクトリへHEADを展開してパッチを実適用し、untracked 8件はバイト一致、tracked 23件はGitのCRLF変換を正規化すると一致した。完全な実バイトも `files/` に保存済み。

破棄前に全31ファイルのSHA256を再確認した。tracked 23件だけを `git --literal-pathspecs restore --source=HEAD --worktree -- <限定パス>` で戻し、untracked 8件は削除せず `parked-untracked/` へ移動した。無関係な変更はなかった。`reset --hard` / `clean -fd` / 履歴の書換えは使っていない。

developはローカル独自コミット0、取得したorigin/developへ210コミット分をfast-forward更新した。指定の同名ローカルブランチは存在せず、新規作成した。`git merge --ff-only origin/develop` はユーザー指定のdevelop更新であり、作業ブランチをdevelopへマージしたものではない。

## 再調査と分類

[画面分類表](pwa-screen-inventory.md) に非ゲスト全14画面を記録した。必要2、条件付き4、不要8。

- 前回より案内マップ編集（`/event/[eventId]/management/guide-map/edit`）が1画面増えている。
- メンバー管理は、今回の「管理専用は不要」という基準に合わせBからCへ見直した。PWAから開ける既存の導線は維持する。
- 最新developには案内マップの下書き・保存ポイント、観測の検出設定・端末計測記録が追加されている。前回のファイルで上書きせず、これらを残して適応した。
- 元のtracked差分のうち14ファイルは最新developの内容と元HEADが同一であることを確認して再適用。最新側が変わっていた7言語のメッセージと観測ページ/試験は、最新コードへ必要箇所だけ適用した。

## 実装内容

スタッフ用manifestは `?audience=staff` の明示分岐で `id: /management`、`start_url: /management` とした。legacyのguest/専用端末用manifest、name/icon/displayを維持。A画面だけにスタッフ用インストール案内を表示し、非HTTPS・非対応環境・standalone表示では誤案内を避ける。インストールは必須にしない。

管理画面（Cのメンバー管理を含む）は切断時に内容と操作・portalをunmountし、再接続後も再読込を要求する。再読込でサーバ認証とデータ取得をやり直す。BFCache復帰でも古い画面をそのまま操作させない。観測端末は既存のカメラ処理を止めず、切断時にサーバ反映を保証しない注意表示を加える。新しい後送キューは追加していない。最新developの既存計測再試行・送信記録は維持する。

案内マップの下書き・server fingerprint・IndexedDBスナップショット、観測の検出設定・端末記録を、サーバが決めたtenant/ユーザー種別/ユーザーIDからなる名前空間に分離した。名前空間の変更でReactのサブツリーを作り直し、前ユーザーのメモリ内状態を引き継がない。所有者不明のlegacyキーは自動移行・削除しない。既存データはブラウザ内に残るが、新しい認証付き画面では読み込まない。これは保存データの暗号化ではなく、表示と所有者の分離である。

案内マップの保存先API・イベントID、既存の権限チェック、観測・メッセージ・通知・共有APIは変更しない。スタッフチャット/Push等の新機能を追加しない。通信断の判定は `navigator.onLine` であり、API到達性の保証ではない。APIの401/403やその他のエラーを一律「オフライン」へ変換しない。

## キャッシュとゲストの境界

本番用Service Worker、Cache Storage、Background Syncは新設していない。認証済みAPIをキャッシュする処理も追加していない。既存のMSWはモック専用。`scope: /` は既存どおりで、`/management` と `/event/...` を包含しguestだけを除く単一prefixがないため、強引に狭めない。scopeは認可の代わりではない。

ゲスト関連ファイルの変更は0件。root layout / proxy / PwaProvider / 既存PwaInstall / legacy manifest生成関数 / 共有oRPC / server認証コード / DB / lockfileは変更しない。guestの既存manifest要求は同じ結果になる分岐を維持し、回帰テストを残している。実行による回帰確認は今回のE2E結果を参照。

## 検証と残課題

詳細は [検証結果](pwa-test-results.md)。変更前developには637件の整形エラーと既存警告2件があり、PWA差分適用前にJSONで保存した。無関係な一括整形はしない。変更ファイルのBiomeと型チェックが成功。単体1,259件とStorybook136件が成功、既存PostgreSQL試験6件のみskip。全E2E408件と非モック本番buildも成功。詳細・スキップ・環境制約は検証記録に記載した。

前回は依存同期がGitHub Packagesの401で停止した。今回、更新済み `.env` のNPM_TOKENで同じパッケージにHTTP 200を確認し、pnpm12.18.0の `install --frozen-lockfile` が23.4秒で成功した。トークンを表示・ファイルへ平文保存せず、一時userconfigの環境変数参照でプロセスだけへ渡した。package.json/lockfile/既存認証設定を変更していない。

Android Chrome/iOS Safariの実機、OSへインストールしたPWA、実IdPでのアカウント切替は未検証。legacy id `/` で既にインストール済みのアプリは自動移行しない。新しいstaff idの扱いは実機確認が必要。旧下書きの所有者が不明なため自動移行しない点も、リリース前に案内・復旧方針を決める必要がある。

今回の再開ではブランチ切替・develop再取得・PWA再実装を行っていない。既存の実装と変更を維持し、インストール済みNext.js16.4.6のmanifestガイドを確認した。本報告書を含む最終成果を同じ指定ブランチのローカルコミットへまとめる。最終コミットSHAは表のGitコマンドで取得でき、実値を完了時の回答に記載する。Push・PR作成・develop/mainへのマージ・デプロイ・本番DB変更は行わない。

## 参照資料

- [Next.js 16.4.6 manifest](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest)
- [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [React useContext](https://react.dev/reference/react/useContext)
- `docs/setup-for-npm-package.md`（既存トークンとpnpm userconfigの扱い）

## 変更ファイル一覧

以下は基点developとの差分。すべて本ローカルコミットの対象。

- `docs/pwa-implementation-report.md`
- `docs/pwa-screen-inventory.md`
- `docs/pwa-test-results.md`
- `e2e/guide-map-studio.spec.ts`
- `e2e/observation-devices.spec.ts`
- `e2e/observation.spec.ts`
- `e2e/pwa-install.spec.ts`
- `e2e/pwa-staff.spec.ts`
- `messages/en.json`
- `messages/es.json`
- `messages/ja.json`
- `messages/ko.json`
- `messages/ne.json`
- `messages/zh-Hans.json`
- `messages/zh-Hant.json`
- `playwright.config.ts`
- `src/app/manifest.webmanifest/route.test.ts`
- `src/app/manifest.webmanifest/route.ts`
- `src/app/tenant/[tenantId]/event/[eventId]/management/graph/edit/page.tsx`
- `src/app/tenant/[tenantId]/event/[eventId]/management/guide-map/edit/page.tsx`
- `src/app/tenant/[tenantId]/event/[eventId]/management/page.tsx`
- `src/app/tenant/[tenantId]/event/[eventId]/observation/[edgeDeviceId]/page.test.tsx`
- `src/app/tenant/[tenantId]/event/[eventId]/observation/[edgeDeviceId]/page.tsx`
- `src/app/tenant/[tenantId]/event/[eventId]/observation/page.tsx`
- `src/app/tenant/[tenantId]/management/members/page.tsx`
- `src/app/tenant/[tenantId]/management/page.tsx`
- `src/app/tenant/[tenantId]/managementPages.test.tsx`
- `src/app/tenant/[tenantId]/page.tsx`
- `src/components/pwa/pwa-provider.test.tsx`
- `src/components/pwa/staff-online-boundary.test.tsx`
- `src/components/pwa/staff-online-boundary.tsx`
- `src/components/pwa/staff-pwa-install.tsx`
- `src/components/pwa/staff-storage-provider.test.tsx`
- `src/components/pwa/staff-storage-provider.tsx`
- `src/features/guide-map-studio/editor/VenueMapStudio.tsx`
- `src/features/tenant/management/components/ManagementHeader.tsx`
- `src/features/tenant/management/members/TenantMembers.tsx`
- `src/features/tenant/observation/components/CrowdDetection.tsx`
- `src/features/tenant/observation/components/MeasurementRecordPanel.tsx`
- `src/features/tenant/observation/hooks/useObservationReporting.ts`
- `src/features/tenant/observation/utils/measurementRecords.test.ts`
- `src/features/tenant/observation/utils/measurementRecords.ts`
- `src/lib/pwa/staff-manifest.test.ts`
- `src/lib/pwa/staff-manifest.ts`
- `src/lib/pwa/staff-storage.test.ts`
- `src/lib/pwa/staff-storage.ts`
