# PWA画面棚卸し

調査日: 2026-11-16。基点: `develop` / `17bcb1484b108af8449003dba6caa9490105196b`。`src/app/**/page.tsx` の非ゲスト14画面、17個のRoute Handlerと、各画面のコンポーネントを確認した。A=必要（主対象）、B=条件付き（アプリ内利用可・オンライン必須）、C=不要（入口・補助）。Aもオフライン利用を意味しない。

## ホストとURL

- ルートホストは `src/lib/control/tenant.ts`、テナント解決は `src/proxy.ts` / `src/server/tenantSubdomain.ts`。
- テナントホストの公開URL `/management` 等は内部の `/tenant/[tenantId]/management` 等へrewriteされる。内部 `/tenant/...` への直接アクセスは遮断される。
- 以下の「root」はルートホスト、「tenant」はテナントホスト。URLのIDは動的値。
- ゲストの2つのpage定義と配下の導線は分類対象外。ファイル・API・既存manifestの挙動を変更しない。

## 全非ゲスト画面

| ルート                                               | 表示名                           | 利用ロール                                                       | 現状                                                                             | A・B・C | 判定理由                                                                 | オフライン方針                                                             | 対応状況                                                   | テスト                                           |
| ---------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------ |
| root `/`                                             | テナント作成入口                 | 公開                                                             | onboardingリンク                                                                 | C       | 現場操作ではない                                                         | キャッシュ追加なし                                                         | なし                                                       | routing / onboarding                             |
| root `/onboarding`                                   | テナント作成                     | 登録開始者                                                       | 作成フォーム・登録状態復元                                                       | C       | 初回登録の補助                                                           | サーバ応答が必須                                                           | なし                                                       | onboarding                                       |
| root `/login`                                        | ログイン・新規登録               | 認証開始者                                                       | IdP challenge必須、モック時404                                                   | C       | 認証の入口                                                               | キャッシュ追加なし                                                         | なし                                                       | auth / login単体                                 |
| root `/auth/error`                                   | ログイン失敗                     | 公開                                                             | 検証済みtenantへの復帰リンク                                                     | C       | エラー補助                                                               | キャッシュ追加なし                                                         | なし                                                       | auth                                             |
| root `/auth/logged-out`                              | ログアウト完了                   | 公開                                                             | tenantへの再ログイン・machine復帰                                                | C       | 認証補助                                                                 | キャッシュ追加なし                                                         | なし                                                       | auth / logged-out単体                            |
| tenant `/`                                           | Tenant Top                       | 公開                                                             | tenant ID表示、PWA案内。業務ホームではない                                       | C       | 仮のトップ。スタッフ入口は別に存在                                       | キャッシュ追加なし                                                         | この画面のインストール案内を除去。既存root復帰処理は維持   | routing / PWA既存                                |
| tenant `/management`                                 | イベント管理                     | staff（ownerを含む）                                             | `requireStaff`、検索・イベント作成・アーカイブ・復元                             | A       | スタッフがイベントへ入る既存の起点                                       | 通信断では情報・操作を隠し、再読込必須                                     | スタッフmanifest・インストール案内・オンライン境界         | tenant-management / auth / PWA                   |
| tenant `/management/members`                         | メンバー管理                     | staff、実操作はbackendのtenant権限に従う                         | `requireStaff`、招待・ロール・削除等                                             | C       | メンバー・権限の管理専用。主要な現場操作ではない                         | 通信断時の編集・保存不可                                                   | オンライン境界・狭幅でheaderと行を折返し                   | tenant-members / event-roles / PWA               |
| tenant `/invitation/accept`                          | 招待受諾                         | 招待token保持者                                                  | Cookieに保持した招待の受諾                                                       | C       | 登録・認証補助                                                           | サーバ応答が必須                                                           | なし                                                       | invitation                                       |
| tenant `/event/[eventId]/management`                 | イベント管理・ルート図           | staff、event権限はbackend                                        | `requireStaff`、地図閲覧・観測点紐付け・観測設定。ライブ混雑表示は未実装         | A       | 現場地図の既存画面                                                       | 通信断時は地図・設定を隠す                                                 | スタッフmanifest・案内・オンライン境界・狭幅header調整     | management / graph / PWA                         |
| tenant `/event/[eventId]/management/graph/edit`      | ルート図編集                     | staff、event編集権限はbackend                                    | `requireStaff`、ノード・経路編集・保存                                           | B       | 設定・編集機能                                                           | 通信断時の編集・保存不可、未保存編集は再読込で破棄                         | スタッフmanifest・案内除去・オンライン境界                 | graph-editor系 / PWA                             |
| tenant `/event/[eventId]/observation`                | 観測端末一覧                     | staff、event権限はbackend                                        | 端末一覧・登録・映像確認・カメラ接続                                             | B       | 機器管理、カメラ・オンライン依存                                         | 通信断時の管理操作不可                                                     | `requireStaff`・スタッフmanifest・案内除去・オンライン境界 | observation-devices / camera-authorization / PWA |
| tenant `/event/[eventId]/observation/[edgeDeviceId]` | 観測・カメラ検知                 | staff / 対応するmachine、匿名はローカル表示のみ（APIは別途認証） | `getViewer`、ソフトロック、カメラ、Wake Lock、検知・報告・端末記録/JSONL書き出し | B       | 専用端末と権限・前景実行が必要                                           | ローカル検知と既存報告再試行は維持。切断表示を追加しサーバ反映を保証しない | 案内除去、接続状態の注意表示。既存端末用起動URLは維持      | observation / reporting単体 / PWA                |
| tenant `/event/[eventId]/management/guide-map/edit`  | 案内マップ編集（VenueMapStudio） | staff、保存はevent backend権限                                   | `requireStaff`、複数マップ・スナップショット・サーバ保存                         | B       | 既存のイベント内導線から開く制作・設定機能。単独のインストール訴求は不要 | 通信断でサーバ操作停止。復帰後再取得。既存下書きは利用者/tenantで分離      | staff manifest・案内除去・オンライン境界・保存名前空間     | guide-map-studio / PWA / storage単体             |

実装根拠は各URLに対応する `src/app` のpageと、`src/features/tenant/management` / `observation` / `webrtc`。ロールは画面の表示可否とAPIの操作権限を区別した。PWAは追加の権限を与えない。

## 同一URL内の機能

| 親画面                | 実在する機能・モーダル                                                                                                | 分類・依存                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `/management`         | CreateEventForm / ArchiveEventDialog / RestoreEventButton、検索・状態フィルタ                                         | B。サーバ確認後に変更を反映                                                    |
| `/management/members` | CreateInvitationForm / MemberActionDialog / EventRolesDialog                                                          | C。招待作成・失効、役割変更・メンバー削除・イベント割当                        |
| event management      | ObservationSettingsSection / ObservationLinkPanel / 言語・テーマメニュー                                              | B。設定・紐付けの保存はオンライン必須                                          |
| guide-map edit        | VenueMapStudio / タブ・下書き・IndexedDB保存ポイント・server保存・比較/読み込み                                       | B。下書き・保存ポイントはアカウント/tenantで分離し、サーバ保存はオンライン必須 |
| graph edit            | SidePanel / ノード・経路・グループcontext menu / 多言語ラベル / layout                                                | B。ローカル編集後の保存はサーバ応答必須                                        |
| observation一覧       | RegisterEdgeDeviceForm / UnregisterEdgeDeviceDialog / CameraProvisioningDialog / StopCameraDialog / VideoReceiverView | B。WebRTC・Firebase signaling・デバイス認可                                    |
| observation端末       | ObservationSoftLock / DetectionSettingsPanel / ScreenWakeControl / CameraConnectionAuthorizationNotice                | B。ローカルロックはサーバ認証の代わりではない                                  |

独立URLとしてのスタッフチャット・通知一覧・タスク・担当管理・優先ルート/誘導提案・分析/統計/レポート・通知設定・アカウント設定・企業紹介・規約・プライバシー・ヘルプ・パスワード再設定・メンテナンスは未実装。存在しない画面は追加しない。スタッフ側Web Pushは未実装。ゲスト固有の情報ウィジェットは対象外。

## Route Handler・リダイレクト・エラー

画面ではないが起動・復帰に必要なものも確認した。以下はいずれもC（補助、保存・認証処理はオンライン必須）。

| ホスト | 実URL                                                                                | 用途                                                      |
| ------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| 共通   | `/manifest.webmanifest`                                                              | 既存manifest。スタッフは `?audience=staff` を選択         |
| 共通   | `/api/auth/[...all]`                                                                 | Better Auth / OAuth / session                             |
| 共通   | `/rpc/[[...rest]]`                                                                   | oRPC（guestも共有）。CSRF plugin、backend認可。変更しない |
| root   | `/auth/begin`                                                                        | IdP認可開始                                               |
| root   | `/onboarding/start`, `/onboarding/claim`                                             | 登録・claim                                               |
| tenant | `/auth/login`, `/auth/handoff`, `/auth/logout`, `/auth/join`                         | スタッフ認証開始・引渡し・logout・招待参加                |
| tenant | `/invitation`, `/invitation/handoff`                                                 | 招待入口・引渡し                                          |
| 共通   | `/api/auth/machine/start`, `/api/auth/machine/callback`, `/api/auth/machine/handoff` | 観測machine認証                                           |
| 共通   | `/api/auth/connection/start`, `/api/auth/connection/callback`                        | カメラ接続認可                                            |

独自 `error.tsx` / `not-found.tsx` / maintenance pageは存在せず、Next.js既定の404・エラー境界を使用（C）。`/tenant/...` や不正hostはproxyで404。認証return URLは `sameHostPath` とtenant host検証を使用する。

## ゲストとの境界

ゲストページは完全に分類対象外。ゲストのファイル・UI・ルーティングは変更しない。共有manifestの既存分岐と既存guest E2Eだけで回帰を確認する。

更新済みトークンで依存同期が成功し、現在の実装の単体・Storybook・型・Lint検証が通過した。E2E408件と非モック本番ビルドも成功。詳細は `pwa-test-results.md` を参照。前回の合格件数は今回へ転用しない。

root layout / PwaProvider / legacy manifest / oRPC / graph取得は共有。スタッフ専用manifest、専用接続境界、専用インストールwrapperを追加して分岐する。guest配下・guest feature・共有graph API・共有認証・proxyは変更しない。

既存 `scope: /` は、`/management` と `/event/...` が離れておりguestも `/event/...` にあるため、単一prefixで分離できない。scopeは認可・キャッシュ境界ではない。今回拡大・縮小しない。スタッフ専用prefix/別originへの移設はルーティングの別案件。既にインストールされたlegacy PWAの起動先・rootでの最終ページ復元は従来どおりであり、スタッフ用の新規インストールは明示的な `/management` 起動でこれに依存しない。

## 最新developとの差分

前回は13画面。今回は案内マップ編集を追加して14画面（A:2、B:4、C:8）。メンバー管理は今回の「管理専用は不要」という基準に合わせBからCへ見直した。CもPWAからの遷移を禁止する意味ではない。

案内マップの下書き・サーバ指紋・IndexedDBスナップショット、観測の検出設定・計測記録が追加されている。既存の保存機能を維持しながら、tenantとアカウント別の名前空間に分離する。所有者不明の旧保存キーは自動移行せず、削除もしない。
