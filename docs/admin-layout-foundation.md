# 管理者・スタッフ向け共通レイアウト

## レイアウト構造と対象ルート

Next.js 16.4.6 の App Router で、既存のテナントレイアウトの内側に `(management)` ルートグループを設置した。テナントのサブドメインを解決する Proxy と、ブラウザに表示されるURLは従来どおり。

```text
src/app/layout.tsx
└── tenant/[tenantId]/
    ├── layout.tsx
    ├── (management)/
    │   ├── layout.tsx                  Layer 1
    │   ├── management/
    │   │   ├── page.tsx
    │   │   └── members/page.tsx
    │   └── event/[eventId]/
    │       ├── management/
    │       │   ├── page.tsx
    │       │   ├── graph/edit/page.tsx
    │       │   └── guide-map/edit/page.tsx
    │       └── observation/
    │           ├── page.tsx
    │           └── [edgeDeviceId]/page.tsx
    └── event/[eventId]/guest/           ゲスト用の既存ルート
```

| 画面 | テナント上の公開URL |
| --- | --- |
| イベント一覧 | `/management` |
| メンバー管理 | `/management/members` |
| イベント管理詳細 | `/event/[eventId]/management` |
| ルート図編集 | `/event/[eventId]/management/graph/edit` |
| 案内マップ・スタジオ | `/event/[eventId]/management/guide-map/edit` |
| 観測デバイス管理 | `/event/[eventId]/observation` |
| デバイス別観測 | `/event/[eventId]/observation/[edgeDeviceId]` |

`/guest` と QR ロケーション付きのゲスト画面、テナントトップ、招待、オンボーディング、認証画面は従来のルートに属する。

## Layer 1 と各ページの責務

`(management)/layout.tsx` は Server Component として、一つの `ManagementHeader` とページの `children` を `ManagementShell` に渡す。ヘッダーは既存のイベント一覧と同じ順番で、メンバー管理、PWA インストール、言語切替、テーマ切替、ログアウトを表示する。スタッフは、他の管理・観測画面からヘッダー左上の矢印で一覧に戻れる。保存済みの絞り込みと表示位置は従来の処理で復元する。

イベント一覧のPC表示では、CSS Grid でヘッダーとコンテンツをサイドバーの右に配置する。タブレットとスマートフォンでは従来どおり全幅とする。イベント一覧と観測画面ではページのスクロールを使い、ルート図・案内マップのキャンバスはビューポートから共通バーの高さを引いた領域を使う。

| コンポーネント | 用途 |
| --- | --- |
| `ManagementShell` | 共有ヘッダーと Layer 2 の配置を管理するルートコンテナ |
| `ManagementBanner`、`ManagementNavigation`、`ManagementMain` | バナー、ナビゲーション、メインを画面ごとの配置に組み込むための共通領域 |
| `ManagementHeader`、`ManagementHomeTitle` | イベント一覧の上部バーを表示し、一覧以外のスタッフ向け画面で左矢印を一覧へのリンクにする |
| `ManagementControls` | 既存の PWA インストール、言語・テーマ切替、ログアウトを描画 |
| `ManagementPageHeading` | Layer 2 の画面名とイベント固有のナビゲーションを表示 |

各ページはイベントIDなどの `params`、業務データ、画面固有の状態やスクロールを管理する。イベント固有のリンクは現在のページの情報で描画し、親レイアウトはテナント単位の共通操作を表示する。イベント一覧のサイドバー・検索・フィルター・作成・「管理する」は従来の配置を使う。

## 認証と Provider

Root Layout の翻訳・テーマ・React Aria ルーター・PWA Provider と、テナントレイアウトの Firebase Provider は維持した。デバイス別観測のスクリーンウェイクと操作領域は従来のページ内に置き、ロック中は React Aria のモーダルで共通バーを含む背後のフォーカスと操作を止める。

ページの `requireStaff`、観測端末の `getViewer` による判定と、API・Server Action の認可は元の位置で実行する。観測デバイス一覧は画面表示と業務データの取得で認可位置が異なる既存構成を維持した。同ページのイベント管理詳細へのリンクとデバイス別観測の戻りリンクは、スタッフかつイベントの `events.read` がある場合に表示する。イベント管理詳細の案内マップ編集には `events.read` と `events.manage`、観測デバイス管理には `events.read` を使う。共通バーのイベント一覧へのリンクはスタッフ向けで、メンバー管理リンクには `tenant.read` が必要。トークンはサーバー側で扱い、表示可否だけを利用する。

## 既存画面からの変更

- イベント一覧の固定ヘッダーとサイドバーは従来の位置にある。他の6画面では共通バーを1つ表示し、画面別のヘッダーに置いていた言語・テーマ等の操作を整理した。
- メンバー管理とイベント管理詳細から一覧へ戻る導線は、共通バー左上の矢印に統合した。ルート図・案内マップから同じイベントの管理詳細へ戻るリンクと、各画面の編集ツールバーは引き続き利用できる。
- 狭い画面では共通バー・メンバー一覧の操作・編集ツールバーが折り返す。案内マップの作業領域が収まらない場合はスタジオ内で横に移動できる。

### イベント一覧の前後比較

同じ Chromium、ライトテーマ、日本語、モックデータでイベント一覧の上部620pxを撮影し、ピクセル単位で比較した。

| 画面幅 | 差分ピクセル | バーの位置と大きさ（変更前後共通） |
| --- | ---: | --- |
| 320px | 0 | 左端 x=0、幅320px、高さ141px |
| 768px | 0 | 左端 x=0、幅768px、高さ85px |
| 1440px | 0 | 左端 x=224、幅1216px、高さ73px |

## 変更ファイル

- ルートは上記ディレクトリ図の7ページを移動し、`(management)/layout.tsx` を追加した。デバイス別観測の `page.test.tsx` もページと一緒に移動した。
- `src/features/tenant/management/components/` の `ManagementShell.tsx`、`management-shell.module.css`、`ManagementHeader.tsx`、`ManagementHomeTitle.tsx`、`ManagementPageHeading.tsx`、`ManagementControls.tsx` に共通領域と操作を配置した。
- `TenantEvents.tsx`、`GraphEditorToolbar.tsx`、`TenantMembers.tsx`、`CreateInvitationForm.tsx`、`GuideMapStudio.tsx` で画面固有の配置を調整した。
- `headerAccess.ts` と `events/navigationAccess.ts` に表示用の権限判定を置いた。テストは `headerAccess.test.ts`、`managementPages.test.tsx`、デバイス別観測の `page.test.tsx`、`e2e/admin-layout-foundation.spec.ts` を追加・更新した。
- 共通バー仕様の変更では、`events/EventListBackLink.tsx` と `ObservationSoftLock.tsx` を更新し、`(management)/layout.test.tsx`、`e2e/event-management-ux.spec.ts`、`e2e/guide-map-studio.spec.ts`、`e2e/observation.spec.ts` に検証を追加・更新した。

## 検証結果

- 全ユニットテストは1,269件成功、既存の7件をスキップ。スタッフ・観測端末・未認証セッションで共通バーのリンク表示が適切に変わることを確認した。
- 関連E2Eは243件成功。管理・観測7画面の320px、768px、1440pxでの表示、7ロケール、共通バーから一覧に戻る遷移、絞り込みとスクロール位置の復元、編集操作、観測ロック中の操作制限、ゲストと未知のテナントの分離を確認した。
- 標準Turbopackのプロダクションビルドと `tsc --noEmit` は成功。
- Biome の lint は成功。既存の認証テストの未使用コード警告2件と、ローカルの Biome CLI と設定スキーマのバージョン差分の通知が残っている。
- E2E はモック環境を使用した。本番IdPでのロール別の確認と、実環境の複数テナントを使った確認は別途必要。

## 拡張方法

管理・スタッフ向けの新規ルートを `(management)` 配下の該当区間に置くと、共通バーが適用される。ページは認証後に `ManagementPageHeading` と `ManagementMain` を使い、画面を切り替えた際に変わるイベント情報は各ページの `params` で解決する。画面固有のツールバーやリンクは該当ページに置き、必要な範囲で表示する。
