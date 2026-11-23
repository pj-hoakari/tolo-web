# 管理者画面のナビゲーション調査

## 1. 調査概要

`src/app/` の `page.tsx` 16件を確認した。管理・観測7件と、テナントの入口・登録・認証など7件を一覧に記載し、来場者向け2件は対象外とした。各ページから呼ばれるコンポーネント、パス生成関数、Proxy、認証・データ取得処理、既存テストをソースで確認した。`layout.tsx` は調査範囲外とし、Route Handler は遷移経路の確認に限って参照した。

テナントの公開URLはテナントのサブドメイン上のパスで表す。`src/proxy.ts` がホスト名から `tenantId` を解決して `/tenant/[tenantId]` 配下に内部書き換えする。`/tenant/...` への直接アクセスは Proxy が遮断する。`[eventId]` は対象イベントのID、`[edgeDeviceId]` は観測ページ用デバイスのIDを表す。ルートホストとテナントホストは `src/lib/control/tenant.ts` の判定に従う。

アクセス権限はページの入口と画面内の操作を分けて確認した。`requireStaff` は同じテナントのスタッフセッションを要求し、未認証なら元のパスを指定してログインへ、端末用セッションなら認証エラーへ遷移させる。ここでの「スタッフ」はセッション種別で、`owner` を含む。ページ側の `requireStaff` はテナントロールやイベントロールを個別に判定しない。データ取得・更新は `src/server/auth/session.ts`、`src/server/authorize.ts` と各サービスクライアントが取得する `tenant_access` またはイベント単位の `event_access` に従う。イベントロールに応じたトークン発行とスコープは `README.md` の「ログインとセッションの引き渡し」「テナントのメンバー管理ページ」も参照した。

## 2. 既存ページ一覧

| ページ | 公開URL | ファイルパス | 用途 | 必要な権限・条件 | 管理者画面からの到達 | 分類 |
| --- | --- | --- | --- | --- | --- | --- |
| イベント一覧（テナントのイベント管理） | テナント `/management` | `src/app/tenant/[tenantId]/management/page.tsx` | イベントの一覧・検索・作成・状態管理 | スタッフ。イベントの一覧・更新は `tenant_access` によるサービス側の判定 | 管理画面の起点。メンバー管理、イベント管理詳細から戻れる | 必須 |
| メンバー管理 | テナント `/management/members` | `src/app/tenant/[tenantId]/management/members/page.tsx` | メンバー・招待・テナントロール・イベントロールの管理 | スタッフ。メンバー一覧は `tenant.read`、招待一覧・招待操作・ロール変更・メンバー削除は `tenant.write` | イベント一覧ヘッダーから直接 | 必須 |
| イベント管理詳細 | テナント `/event/[eventId]/management` | `src/app/tenant/[tenantId]/event/[eventId]/management/page.tsx` | 観測設定、ルート図の表示、観測点との紐づけ | スタッフ。観測設定やグラフ取得・更新には対象イベントのコンソール用 `event_access` と操作に応じた権限 | イベント一覧のイベント名・「管理する」・作成直後の案内から直接 | 必須 |
| ルート図編集 | テナント `/event/[eventId]/management/graph/edit` | `src/app/tenant/[tenantId]/event/[eventId]/management/graph/edit/page.tsx` | グラフの構造・ラベルを編集・保存 | スタッフ。グラフの取得・保存は対象イベントのコンソール用 `event_access` で認可 | イベント管理詳細の「グラフを編集」から直接。グラフの読込完了後に表示 | 条件付き |
| 案内マップ・スタジオ | テナント `/event/[eventId]/management/guide-map/edit` | `src/app/tenant/[tenantId]/event/[eventId]/management/guide-map/edit/page.tsx` | 来場者に公開する案内マップを編集。一時保存はブラウザ、確定保存は Graph Authoring | スタッフ。地図・グラフの取得と地図の確定保存は対象イベントのコンソール用 `event_access` で認可 | 管理画面からのリンクなし。既知のURLを直接開く方法を README と既存E2Eの `page.goto` で確認 | 必須 |
| 観測デバイス管理 | テナント `/event/[eventId]/observation` | `src/app/tenant/[tenantId]/event/[eventId]/observation/page.tsx` | 観測ページ・カメラの登録、接続許可、配信確認、登録解除 | スタッフ。デバイス操作・取得に対象イベントのコンソール用 `event_access`、接続操作には接続認可が関係する | イベント管理詳細のヘッダーから直接 | 必須 |
| デバイス別観測 | テナント `/event/[eventId]/observation/[edgeDeviceId]` | `src/app/tenant/[tenantId]/event/[eventId]/observation/[edgeDeviceId]/page.tsx` | カメラ映像と人数検知・計測、観測用端末の認可 | ページ自体は `getViewer` を使用。通常のデータ利用は、イベント権限のあるスタッフか対象イベント・デバイスに一致する端末セッションで認可される。ページの報告機能は一致する端末セッションで有効（モックを除く）。画面操作にはローカルの解除コードも必要 | 観測デバイス管理で観測ページ登録後に開く・URLをコピー。またはオフラインの観測ページ行から開く | 条件付き |
| テナントトップ | テナント `/` | `src/app/tenant/[tenantId]/page.tsx` | `Tenant Top` とテナントIDの表示 | Proxy で解決できるテナント。ページ自身にセッションチェックなし | 管理画面からのリンクなし。直接URL、またはモックのテナント作成完了リンク | 不要 |
| ルートトップ | ルート `/` | `src/app/page.tsx` | テナント作成の入口 | ページ自身にセッションチェックなし | 管理画面からのリンクなし。ルートホストを直接開く | 不要 |
| テナント作成 | ルート `/onboarding` | `src/app/onboarding/page.tsx` | テナントの仮登録と所有権取得の開始 | フォーム表示にスタッフ認証は不要。実際の所有権取得には登録認可が必要 | ルートトップから開く | 不要 |
| ログイン・サインアップ | ルート `/login` | `src/app/login/page.tsx` | IdP のログイン入力または登録入力 | IdP が発行する `challenge` が必要。欠落時は認証エラー、認証モック時は404 | スタッフ認証や登録の途中で IdP から遷移 | 不要 |
| 認証エラー | ルート `/auth/error` | `src/app/auth/error/page.tsx` | 認証エラーと再試行の案内 | ページ自身にセッションチェックなし。有効なテナントホストが `host` にある場合に管理画面への再試行リンク | 認証失敗時や端末セッションでスタッフ専用ページを開いたときに遷移 | 不要 |
| ログアウト完了 | ルート `/auth/logged-out` | `src/app/auth/logged-out/page.tsx` | ログアウトの完了、管理画面の再入口または端末ページへの復帰 | ページ自身にセッションチェックなし。有効な `state` からリンク先や端末の戻り先を解決 | ログアウト操作の完了後に遷移 | 不要 |
| 招待の受諾 | テナント `/invitation/accept` | `src/app/tenant/[tenantId]/invitation/accept/page.tsx` | 発行済みの招待を受けた人がテナントに参加 | 招待URLから設定された Cookie がある場合に参加画面を表示。受諾には有効な招待と登録認可が必要 | 管理画面で招待を発行し、受領者が招待URLを開くと遷移 | 不要 |

対象外と判定したのは、来場者用 `GuestPage` を表示するテナントの `/event/[eventId]/guest`（`src/app/tenant/[tenantId]/event/[eventId]/guest/page.tsx`）と `/event/[eventId]/guest/[qrLocationId]`（`src/app/tenant/[tenantId]/event/[eventId]/guest/[qrLocationId]/page.tsx`）。案内マップ・スタジオは来場者向けの地図を作成するスタッフ専用画面のため調査対象に含めた。

## 3. 管理者画面からアクセスが必要なページ

| 分類 | ページ | 判定理由 |
| --- | --- | --- |
| 必須 | イベント一覧、メンバー管理 | テナント単位でイベントを選ぶ、またはメンバー・招待を管理する入口。既存導線を維持する |
| 必須 | イベント管理詳細、観測デバイス管理 | 日常のイベント運営で使う。イベント一覧からイベントを選び、詳細からデバイス管理に移る既存導線を維持する |
| 必須 | 案内マップ・スタジオ | 地図の準備・更新のたびに対象イベントから編集を開始できる必要がある。既存の画面間リンクが欠けている |
| 条件付き | ルート図編集 | 構造を編集するときに使う。ルート図ツールバーの既存リンクを維持する |
| 条件付き | デバイス別観測 | 観測対象のデバイスを選んだときに使う。構成・状態に応じた既存リンクと観測端末へのURL受け渡しを維持する |

## 4. リンク追加が不要なページ

| ページ | 追加が不要な理由 |
| --- | --- |
| テナントトップ `/` | テナントIDを表示するページ。日常の管理機能は `/management` にある |
| ルートトップ `/`、テナント作成 `/onboarding` | 新規テナントの作成はルートホストから開始する独立したフロー |
| `/login`、`/auth/error`、`/auth/logged-out` | 認証フローが必要なタイミングで開き、必要なパラメータも渡す |
| `/invitation/accept` | 招待された本人が招待URLから進む画面。発行者の入口はメンバー管理の招待フォーム |

## 5. 現在のリンク状況と問題点

| 出発画面 | リンク・ボタン | 遷移先・表示条件 | 実装箇所 |
| --- | --- | --- | --- |
| イベント一覧 | メンバー管理 | `/management/members` | `src/features/tenant/management/components/ManagementHeader.tsx` |
| イベント一覧 | イベント名、管理する、イベント種別を設定する | いずれも `/event/[eventId]/management`。イベント種別を設定するリンクは作成成功時の案内に表示 | `src/features/tenant/management/events/TenantEvents.tsx` |
| メンバー管理 | イベント管理 | `/management` | `src/app/tenant/[tenantId]/management/members/page.tsx` |
| イベント管理詳細 | イベント一覧に戻る | `/management`。保存済みの検索条件があればクエリに復元し、一覧の表示位置も復元する | `src/features/tenant/management/events/EventListBackLink.tsx` |
| イベント管理詳細 | 観測デバイス管理 | `/event/[eventId]/observation` | `src/app/tenant/[tenantId]/event/[eventId]/management/page.tsx` |
| イベント管理詳細 | グラフを編集 | `/event/[eventId]/management/graph/edit`。`GraphViewer` が読込完了時にツールバーを表示 | `src/features/tenant/management/graph/components/GraphViewer.tsx`、`src/features/tenant/management/graph/components/GraphViewerToolbar.tsx` |
| ルート図編集、案内マップ・スタジオ | 管理ページへ戻る | `/event/[eventId]/management` | `src/features/tenant/management/components/ManagementBackLink.tsx` |
| 観測デバイス管理 | 管理ページ | `/event/[eventId]/management` | `src/app/tenant/[tenantId]/event/[eventId]/observation/page.tsx` |
| 観測デバイス管理 | この端末で開く、URLをコピー | `/event/[eventId]/observation/[edgeDeviceId]`。一覧ではオフラインの観測ページ行に「開く」、観測ページの新規登録直後は発行URLを開く・コピーできる | `src/features/tenant/webrtc/components/AliveEdgeList.tsx`、`src/features/tenant/webrtc/components/RegisterEdgeDeviceForm.tsx` |
| 観測デバイス管理 | 観測ページの接続を許可 | 紐づく観測ページがあるカメラの行・登録直後に接続認可を開始。戻り先は `/event/[eventId]/observation` | `src/features/tenant/webrtc/components/AliveEdgeList.tsx`、`src/features/tenant/webrtc/components/RegisterEdgeDeviceForm.tsx`、`src/features/tenant/webrtc/utils/cameraConnection.ts` |
| デバイス別観測 | この端末で観測する、もう一度認可する | 端末セッションの認可を開始。前者はスタッフかつ失敗表示・認証モックなし、後者は端末認可失敗時。戻り先は同じ観測ページ | `src/app/tenant/[tenantId]/event/[eventId]/observation/[edgeDeviceId]/page.tsx` |
| イベント一覧、メンバー管理、イベント管理詳細、両編集ページ、デバイス別観測 | ログアウト | `/auth/logout` への POST。認証モックでは非表示。同じヘッダーの言語・テーマ切替や、イベント一覧・詳細のPWAインストールはページ内の操作 | `src/features/auth/LogoutButton.tsx` と各ページ・ヘッダー |

- **入口が欠けている機能**。案内マップ・スタジオにはイベント管理詳細へ戻るリンクがある。イベント管理詳細にはスタジオを開くリンクがない。
- **戻り導線の不足**。デバイス別観測のページ内に観測デバイス管理への戻りリンクがない。観測専用端末セッションでは戻り先が `requireStaff` で拒否されるため、追加する場合はスタッフの操作に限る。認証エラー・ログアウト画面には有効なホスト情報がある場合に `/management` へのリンクがあり、招待受諾では `cannotJoin` 時に `/management` へのリンクがある。
- **同じ遷移先を持つリンク**。イベント名と「管理する」は同じ行の同じ遷移先。作成直後の「イベント種別を設定する」も同じ詳細に着くが、作成後の作業を案内する役割がある。観測ページを開くリンクも一覧と登録直後で出発条件が異なる。削除が必要と判断した既存リンクはない。
- **ページ内で完結する操作**。イベントの作成・検索・状態変更・アーカイブ、メンバー・招待・ロールの操作、観測設定の保存、ルート図の紐づけの保存、デバイスの接続・登録解除などは上記画面のフォームやダイアログで行う。今回確認した `page.tsx` にこれらの操作専用ページはない。

## 6. 追加するリンクの候補一覧

| 優先度 | 表示名案 | 遷移先URL | 配置候補 | 権限による表示制御 |
| --- | --- | --- | --- | --- |
| 高 | 案内マップを編集 | テナント `/event/[eventId]/management/guide-map/edit` | イベント管理詳細のヘッダー。「観測デバイス管理」の近くに置き、グラフの読込状態に依存せず選べるようにする | スタッフ専用のイベント管理詳細上に表示。現行の `requireStaff` と Graph Authoring の認可を維持する。編集権限での追加の出し分けは、既存の権限情報で判定可能な場合に検討する。`owner` 固定の条件は現行ページから確認できない |
| 低（任意） | 観測デバイス管理へ戻る | テナント `/event/[eventId]/observation` | デバイス別観測のヘッダー | `getViewer()` が `staff` の場合に限る。観測の端末セッションと未認証では表示しない |

## 7. 次のIssueで実装する内容

1. イベント管理詳細に「案内マップを編集」を追加する。`src/features/guide-map-studio/routes.ts` の `guideMapEditPath(eventId)` を使い、選択中のイベントに対応する公開パスに遷移させる。既存の共通 `Link` と画面文言の翻訳パターンを使う。
2. イベント一覧から対象イベントを開き、スタジオまでたどれること、その既存の「管理ページへ戻る」で同じイベントの管理詳細に復帰することを検証する。スタッフ認証とイベント別の取得・保存権限、および既存の「グラフを編集」「観測デバイス管理」の遷移を維持する。
3. 観測ページからの戻りリンクを次のIssueに含める場合は、スタッフで同じイベントの観測デバイス管理に戻れ、専用端末セッションには表示されないことを確認する。`layout.tsx` を用いたレイアウト統一は別Issueで扱う。
