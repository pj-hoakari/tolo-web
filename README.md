This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## 認証

`web` のサーバーはブラウザのセッションに対応する外部トークンを、Service Gateway と tolo-edge-bridge への呼び出しに付けます。トークンの得かたは環境変数 `AUTH_MOCKING` で切り替えます。

`AUTH_MOCKING` が `enabled` のときは、ログインのないモックを使います。テナントのサブドメインのホストへの要求は、そのテナントのスタッフからの要求として扱います。スタッフのユーザー ID は `AUTH_MOCK_USER_ID` の値で、既定は `user-owner` です。呼び出しには環境変数に設定した固定のトークンを付けます。`tenant_access` には `TENANT_ACCESS_TOKEN`、管理ページの `event_access` には `GRAPH_ACCESS_TOKEN`、観測ページの `event_access` には `OBSERVATION_ACCESS_TOKEN` を使います。`compose.yaml`、`.env.example`、e2e の `playwright.config.ts` は、この変数を `enabled` にします。

モックを使えるのは、`ROOT_DOMAIN` が `localhost` か `localhost` の下のドメインのときです。`ROOT_DOMAIN` を設定しないときは `localhost` になります。ほかのルートドメインでモックを使うときは、そのドメインを `AUTH_MOCKING_ALLOWED_ROOT_DOMAINS` にカンマで区切って並べます。許可されていないルートドメインで `AUTH_MOCKING` を `enabled` にすると、サーバーは起動時に終了します。

`AUTH_MOCKING` が `enabled` でないときは、Better Auth のセッションを使います。セッションと外部トークンは BFF 専用の PostgreSQL に置きます。次の環境変数がすべて必要です。1 つでも欠けていると、サーバーは起動時に終了します。

| 環境変数                 | 内容                                                           |
| ------------------------ | -------------------------------------------------------------- |
| `AUTH_DATABASE_URL`      | BFF 専用の PostgreSQL の接続 URL                               |
| `AUTH_SECRET`            | Better Auth の秘密鍵（32 文字以上）                            |
| `AUTH_IDP_ISSUER`        | tolo-idp の issuer。エンドポイントは Discovery で解決します    |
| `AUTH_IDP_CLIENT_ID`     | BFF の client ID（`console-ui`）                               |
| `AUTH_IDP_CLIENT_SECRET` | BFF の client secret                                           |
| `AUTH_RESOURCE_HOST`     | `resource` の URI に使う論理ホスト。このホストへは通信しません |

データベースのテーブルは、空のデータベースに `db/auth.sql` を 1 回だけ適用して作ります。

```bash
AUTH_DATABASE_URL=postgres://... pnpm db:auth:migrate
```

### ログインとセッションの引き渡し

管理ページを開いたホストにスタッフのセッションがなければ、そのテナントのホストの `/auth/login` へ移ります。ログインは次の順に進みます。

1. テナントのホストがログインを結び付ける値をそのホストに限る Cookie（`SameSite=Lax`、10 分）に置きます。そのあと、ルートドメインの `/auth/begin` へ移ります。
2. ルートドメインが `resource` にテナントの URI、`audience` に `backend-api` を付けて、tolo-idp の認可へ進みます。
3. callback を受けたルートドメインは、ルートドメインのセッションを消し、Better Auth の account の行にも外部トークンを残しません。外部トークンは引き渡しのために保ち、一回限りの引き渡しコード（1 分）を付けて、テナントのホストの `/auth/handoff` へ移ります。
4. テナントのホストは、コードがそのホストのもので期限内であり、1 の Cookie と合うときだけ、そのホストのセッションを作ります。コードは 1 回しか使えません。そのあと、コードを含まない元のページへ移ります。

Better Auth の `baseURL` はルートドメインの origin です。`ROOT_DOMAIN` が `localhost` か `localhost` の下のドメインなら `http`、それ以外なら `https` で、ポートは付けません。tolo-idp の `console-ui` には `redirect_uri` として `<baseURL>/api/auth/callback/tolo-idp` を登録します。認可で求める scope は `openid` と、`tenant.read`、`tenant.write`、`events.read`、`events.manage`、`events.operate`、`events.report` です。tolo-idp は、このうちロールに許された scope だけを発行します。

`/rpc` への要求には、ヘッダ `x-csrf-token: orpc` が必要です。このヘッダのない要求は 403 で拒否します。ブラウザの oRPC のクライアントは、このヘッダを付けて送ります。

### ログイン画面

tolo-idp は、ログイン状態のない認可要求を受けると、login challenge を付けてルートドメインの `/login` へ移します。`/login` は ID とパスワードを受け取り、challenge と一緒にブラウザから tolo-idp の `POST /api/login` へ送ります。tolo-idp が受け付けたら、challenge を付けて認可エンドポイントへ戻り、tolo-idp が元の認可要求を続けます。ID かパスワードが違うときは、同じ画面で入力し直せます。

`/login` の応答には `Content-Security-Policy: frame-ancestors 'none'` を付けて、ほかのサイトに埋め込ませません。`AUTH_MOCKING` が `enabled` のときは、`/login` は 404 を返します。

tolo-idp には login challenge がまだありません（MER-338）。それまでは、次の約束事を仮に置いています。約束事は `src/features/auth/idpLogin.ts` にまとめています。

- tolo-idp は、ログイン画面を `/login?challenge=<challenge>` で開きます。
- `POST /api/login` は issuer と同じ origin にあり、JSON の `username`、`password`、`challenge` を受け取ります。ID かパスワードが違うときは 401 を返します。
- 受け付けた後に、Discovery の `authorization_endpoint` を `challenge=<challenge>` を付けて開くと、tolo-idp は元の認可要求を続けます。

tolo-idp の `POST /api/login` の CORS では、ルートドメインの origin から Cookie を付けて送る要求を許可します。

### ログインに失敗したとき

ログインの途中で失敗すると、ルートドメインの `/auth/error` へ移ります。たとえば、ログインの開始から 10 分を過ぎたとき、引き渡しのコードが使えないとき、tolo-idp が callback にエラーを返したときです。ログインを始めたテナントのホストが分かるときは、そのホストの管理ページへのリンクを出します。リンク先は、ルートドメインの 1 階層下のホストに限ります。

### ログアウト

管理ページのヘッダの「ログアウト」は、そのテナントのホストの `/auth/logout` へ POST します。`/auth/logout` は、`Origin` ヘッダがそのホストの origin でない要求を 403 で拒否します。受け付けると、そのホストのセッションと外部トークンを消し、tolo-idp の `end_session_endpoint` へ移ります。ほかのテナントのホストのセッションは残ります。

`end_session_endpoint` には、`id_token_hint` にセッションの ID Token を、`post_logout_redirect_uri` に `<baseURL>/auth/logged-out` を付けます。ID Token は、Refresh で tolo-idp が発行し直すたびに新しいものへ入れ替えます。tolo-idp の `console-ui` には、この URL を `post_logout_redirect_uri` として登録します。ログアウトしたテナントのホストは `state` で渡し、`/auth/logged-out` はそのホストの管理ページへのリンクを出します。

セッションがすでに切れているホストでは ID Token がないので、tolo-idp を通らずに `/auth/logged-out` へ移ります。このとき tolo-idp のログイン状態は残ります。`AUTH_MOCKING` が `enabled` のときは、ボタンを出さず、`/auth/logout` は 404 を返します。

## Docker Compose での開発環境

`compose.yaml` は Firebase エミュレータ（Firestore と Auth）、開発用の偽 IdP（`fakeidp`）、tolo-edge-bridge、Next.js の開発サーバー（`web`）を起動します。tolo-edge-bridge はすべての RPC で `event_access` トークンを検証します。`compose.yaml` は `AUTH_MOCKING` を `enabled` にするので、`web` は「認証」の節のモックで動きます。このとき `web` は、管理ページと観測デバイス管理ページからの呼び出しでは環境変数 `GRAPH_ACCESS_TOKEN`、観測ページからの呼び出しでは `OBSERVATION_ACCESS_TOKEN` のトークンを `Authorization: Bearer` で tolo-edge-bridge へ送ります。

ブラウザは、tolo-edge-bridge が発行した Firebase のカスタムトークンで Auth エミュレータにサインインしてから、シグナリング文書を読み書きします。Firebase エミュレータはこのリポジトリの `firebase-emulator/` からビルドし、同じディレクトリのセキュリティルール（tolo-edge-bridge のシグナリング文書のルールと同じもの）を適用します。ホストへは Firestore を `localhost:8080`、Auth を `localhost:9099`、Emulator UI を `http://localhost:4000` で公開します。

Service Gateway と Observation は起動しません。代わりに、`web` は環境変数 `OBSERVATION_API_MOCKING` が `enabled` のとき、Observation の手続き（端末一覧、観測地点、ハートビート、計測値の送信）に Service Gateway を呼ばずに応答します。端末一覧は MSW のモックと同じサンプル（`src/mocks/fixtures/edges.ts`）で、観測デバイス管理ページには、稼働中の 2 台とオフラインの 1 台が表示されます。計測値は捨てます。シグナリングはこの切り替えの対象外で、tolo-edge-bridge を通ります。`compose.yaml` はこの変数を既定で `enabled` にします。この切り替えは `NODE_ENV` が `development` のときだけ働きます。

ホストで起動する Next.js（`pnpm dev`）では、`.env.example` のとおりこの変数を `disabled` にし、`GATEWAY_URL` の Service Gateway を呼びます。

`web` はホスト名のサブドメイン名を Service Gateway に問い合わせて、テナントの公開 ID を得ます。環境変数 `TENANT_SUBDOMAIN_MOCKING` が `enabled` のときは問い合わせず、サブドメイン名 `test` だけをテナント `0123456789abcdef` に対応させます。ほかのサブドメイン名のページは見つからない扱いになります。`compose.yaml` はこの変数を既定で `enabled` にします。`.env.example` と、e2e の `playwright.config.ts` も `enabled` にします。e2e は本番ビルドで動くので、この切り替えは `NODE_ENV` によらず働きます。

### トークンの発行

`fakeidp` を先に起動し、管理ページ用と観測ページ用の `event_access` を発行します。

```bash
docker compose up -d fakeidp
export GRAPH_ACCESS_TOKEN=$(curl -sf http://localhost:8082/token \
  -H 'Content-Type: application/json' \
  -d '{"token_use":"event_access","sub":"dev-console","client_id":"console-ui","scope":"events.read","tenant_id":"0123456789abcdef","event_id":"fedcba9876543210","ttl_seconds":86400}' \
  | jq -r .access_token)
export OBSERVATION_ACCESS_TOKEN=$(curl -sf http://localhost:8082/token \
  -H 'Content-Type: application/json' \
  -d '{"token_use":"event_access","sub":"dev-edge","client_id":"edge-page","scope":"events.report","tenant_id":"0123456789abcdef","event_id":"fedcba9876543210","ttl_seconds":86400}' \
  | jq -r .access_token)
```

`client_id` は、管理ページ用を tolo-edge-bridge の `CONSOLE_CLIENT_ID`（`console-ui`）に、観測ページ用を `EDGE_CLIENT_ID`（`edge-page`）に合わせます。tolo-edge-bridge は `client_id` からシグナリングでの役割（`console` または `edge`）を決めます。`tenant_id` と `event_id` は、開くページのテナント ID とイベント ID に合わせます。tolo-edge-bridge は 16 桁の小文字 16 進数以外の ID を拒否します。

`fakeidp` が発行するトークンの有効期限は既定で 5 分なので、`ttl_seconds` で延ばしています。`fakeidp` は起動のたびに署名鍵を作り直すため、再起動した後はトークンを発行し直します。

### 起動

```bash
docker compose up -d --build
```

トークンを発行し直したときは、`docker compose up -d web` で `web` を作り直します。

### 開く URL

テナントはサブドメイン名で決まります。サブドメイン名 `test` が上のトークンのテナント `0123456789abcdef` に対応します。上のトークンに対応する URL は次のとおりです。
- 管理ページ: `http://test.localhost:3000/event/fedcba9876543210/management`
- 観測デバイス管理ページ: `http://test.localhost:3000/event/fedcba9876543210/observation`
- 観測デバイスの観測ページ: `http://test.localhost:3000/event/fedcba9876543210/observation/{edgeDeviceId}`

テナントの公開 ID をホストにした URL（`http://0123456789abcdef.localhost:3000/...`）は 404 になります。

観測ページから映像を配信するには、`public/models` に人検出モデルが必要です（[人検出モデルセットアップ](docs/setup-for-detection-model.md)）。

### スマートフォンから開く

スマートフォンなど別の端末からは、Cloudflare の Quick Tunnel が発行する HTTPS の URL で開きます。カメラと画面の常時点灯は、HTTPS か `localhost` で開いたページでしか使えません。LAN の IP アドレスを http で開いても、観測ページのカメラは起動できません。

Quick Tunnel はローカルの環境をインターネットに公開します。そのため、メール認証を必須にしています。ページを開いた人は `TUNNEL_ALLOWED_MAIL` に指定したアドレスで届くワンタイム PIN を入力して入ります。開く人にもトンネルを立てる人にも、Cloudflare のアカウントは要りません。

`.env` に次を設定します。

```bash
TUNNEL_ALLOWED_MAIL=alice@example.com,bob@example.com
```

トンネルの URL にはテナントのサブドメイン名を付けられないので、トンネルで開くテナントを 1 つに固定します。そのテナントのサブドメイン名を `TUNNEL_SUBDOMAIN` に指定します。既定は `test` で、上のトークンのテナントに対応します。`TUNNEL_ALLOWED_MAIL` には、許可するアドレスをカンマで区切って並べます。`*@example.com` と書くと、そのドメインのアドレスをすべて許可します。

`task tunnel` で、`compose.tunnel.yaml` を重ねて起動します。トンネルがつながると、URL を表示します。起動したあとで URL を確かめるときは、`task tunnel:url` を実行します。`task` は mise で入ります。

```bash
task tunnel
```

観測ページは `https://{発行された URL}/event/fedcba9876543210/observation/{edgeDeviceId}` で開きます。URL は起動のたびに変わります。トンネルを止めると、全員がアクセスできなくなります。

```bash
task tunnel:stop
```

`tunnel-proxy`（Caddy）がトンネルからの通信を Firebase エミュレータと `web` に振り分けます。HTTPS で開いたページは、ページと同じオリジンを通してエミュレータに接続します。

## テナントのイベント管理ページ

`/management` は、テナントのイベントを一覧し、作成し、アーカイブするページです。`AUTH_MOCKING` が `enabled` のとき、`web` はこのページからの呼び出しで、環境変数 `TENANT_ACCESS_TOKEN` の `tenant_access` トークンを Service Gateway（`GATEWAY_URL`）へ送ります。Service Gateway はその呼び出しを Tenant Management へ転送します。

`compose.yaml` は Service Gateway と Tenant Management を起動しません。開発では、tolo-service-gateway の compose で Service Gateway、偽 IdP、Tenant Management を起動し、Next.js はホストで起動します。tolo-service-gateway の Service Gateway は、この compose の Firestore エミュレータと同じポート 8080 を使います。そのため、2 つの compose は同時に起動できません。

### テナントとトークンの用意

tolo-service-gateway のディレクトリで、Tenant Management を含む compose を起動します。次に仮テナントを作り、所有権を取得してから、そのテナントの `tenant_access` トークンを発行します。手順の詳細は tolo-service-gateway の `docs/dev_tenant_management.md` にあります。

```bash
docker compose -f compose.yml -f compose.tm.yml up -d --build

TENANT=$(curl -sS -X POST -H 'Content-Type: application/json' -d '{"name":"acme","contractPlan":"standard"}' \
  http://localhost:8080/tolo.tenant.v1.TenantService/StartTenantRegistration)
TID=$(printf '%s' "$TENANT" | jq -r .tenant.tenantId)
CLAIM=$(printf '%s' "$TENANT" | jq -r .ownershipClaimToken)

REG=$(./scripts/dev/fakeidp-token.sh -k registration -b user-owner -s "tenant.join")
curl -sS -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $REG" \
  -d "{\"tenantId\":\"$TID\",\"ownershipClaimToken\":\"$CLAIM\",\"subdomain\":\"acme\",\"displayName\":\"Owner\"}" \
  http://localhost:8080/tolo.tenant.v1.TenantService/ClaimTenantOwnership

export TENANT_ACCESS_TOKEN=$(./scripts/dev/fakeidp-token.sh -k tenant_access -b user-owner -t "$TID" -s "tenant.read tenant.write events.read events.manage" -l 86400)
echo "$TID"
```

所有権の取得で、テナントのサブドメイン名が `acme` に、オーナーの表示名が `Owner` に決まります。サブドメイン名は後から変えられません。

トークンの `tenant_id` は、開くページのテナント ID と同じでなければなりません。違う場合は Tenant Management が呼び出しを拒否し、一覧は取得に失敗します。

### 起動と開く URL

同じシェルで、このリポジトリのディレクトリから Next.js を起動します。`NEXT_PUBLIC_API_MOCKING` が `enabled` だと API がモックに置き換わるので、ここでは `disabled` にします。サブドメイン名を Service Gateway に問い合わせるため、`TENANT_SUBDOMAIN_MOCKING` も `disabled` にします。`TENANT_ACCESS_TOKEN` を使うため、`AUTH_MOCKING` は `enabled` にします。

```bash
GATEWAY_URL=http://127.0.0.1:8080 NEXT_PUBLIC_API_MOCKING=disabled TENANT_SUBDOMAIN_MOCKING=disabled AUTH_MOCKING=enabled pnpm dev
```

`http://acme.localhost:3000/management` を開きます。`acme` は所有権の取得で決めたサブドメイン名です。

### オンボーディングページでテナントを作る

上の curl の手順の代わりに、ルートドメインのトップ（`http://localhost:3000/`）の「テナントを作成」から `/onboarding` を開いてもテナントを作れます。テナント名、サブドメイン名、オーナーのメールアドレス、オーナーの表示名を入力すると、`web` がテナントの登録を始め、偽 IdP から scope が `tenant.join` の `registration` トークンを発行し、所有権を取得します。オーナーはメールアドレスを `sub` とするユーザーになり、入力した表示名でテナントに所属します。表示名は 64 文字までです。

`web` は偽 IdP の URL を環境変数 `FAKEIDP_URL` から読みます。未設定のときは `http://127.0.0.1:8082` を使います。

## テナントのメンバー管理ページ

`/management/members` は、テナントのメンバーと招待を管理するページです。イベント管理ページのヘッダの「メンバー管理」から開きます。`web` はこのページからの呼び出しでも `tenant_access` トークンを Service Gateway へ送り、Service Gateway は呼び出しを Tenant Management の RelationAdminService へ転送します。メンバーの一覧は `tenant.read` を、招待の作成・一覧・取り消し、テナントロールの変更、メンバーの削除は `tenant.write` を求めます。上の手順の `TENANT_ACCESS_TOKEN` はこの 2 つの scope も持ちます。

招待を作るときは、招待する人の表示名を決めます。招待で付けるテナントロールはスタッフだけです。オーナーを加えるときは、スタッフとして参加した人をメンバーの一覧からオーナーにします。画面はオーナーにする前に電話や対面など別の経路で本人に確かめるよう促し、その手がかりとして参加日時を出します。最後のオーナーをスタッフにする操作と削除する操作は Tenant Management が拒否し、画面はオーナーが 1 人以上必要であることを表示します。

招待を作ると、画面は招待 URL を一度だけ表示します。招待 URL はページを開いているテナントのホストの `/invitation` に招待トークンを付けたもので、テナントの公開 ID を含みません。

## Learn More

To learn more about Next.js, take a look at the following resources:
- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## PWA

Tolo はオンライン専用の PWA としてインストールできます。Next.js 標準の Metadata API・Route Handler とブラウザのインストール機能を使用し、追加ライブラリは使用していません。オフライン対応、PWA 用の Service Worker、Push 通知は対象外です。

### 配信と起動

- 本番環境は HTTPS で配信してください。開発時は `http://localhost:3000` で確認できます。スマートフォンなど別端末から確認する場合は、その端末が信頼する HTTPS URL が必要です。
- 本番ビルドでは `NEXT_PUBLIC_API_MOCKING` を `enabled` に設定しないでください。既存の MSW Service Worker は開発・テスト用の API モックで、PWA のオフライン機能ではありません。
- Manifest の `id`・`scope` は `/` です。テナントのページはサブドメイン名のホストでだけ開けるので、テナントの origin は 1 つです。その origin の全ページが同じアプリ内で開きます。ルートドメインと異なるテナントは別の origin なので、それぞれの URL でインストールしてください。
- 各ページの Metadata は `/manifest.webmanifest?start={公開ページのパス}` を参照し、Manifest の `start_url` にインストールしたページを指定します。初回起動はブラウザの Cookie / localStorage の引き継ぎに依存しません。起動したいページを開いてからインストールしてください。
- 同じ origin の最後の閲覧パスも保存し、アプリが `/` から起動した場合の復帰を補助します。サイトデータを消去すると保存した復帰先は消去されますが、Manifest の起動先は維持されます。
- `/manifest.webmanifest` と PNG アイコンはテナントの内部パスへ書き換えず配信します。公開 URL は引き続き `/event/{eventId}/...` で、`/tenant/{tenantId}/...` は内部ルーティング用です。

### インストール

各ページの「アプリをインストール」ボタンから、端末とブラウザに応じた案内を開けます。
- Chrome / Edge: インストール確認画面を開ける場合は、案内内のボタンでブラウザの確認画面を開き、インストールを確定します。確認画面を開けない場合は表示されたブラウザメニューの手順に従ってください。
- iPhone / iPad: Safari の共有メニューから「ホーム画面に追加」を選び、「追加」で確定します。
- macOS Safari: 「ファイル」メニューの「Dock に追加」から追加します（対応する macOS / Safari が必要です）。
- インストールに対応しないブラウザでは、案内された対応ブラウザで同じ URL を開いてください。

ブラウザのメニュー名は OS・言語・バージョンで異なる場合があります。アプリとして起動している場合はインストールボタンを表示しません。

### アイコンの差し替え

暫定アイコンは既存の `src/app/favicon.ico` に含まれるデフォルト画像から生成しています。ブランドアイコンを用意したら、次のファイルを差し替えてください。PNG は記載の寸法を維持します。

| ファイル                      | 用途 / 寸法                  |
| ----------------------------- | ---------------------------- |
| `public/icon-192x192.png`     | Manifest / 192 × 192         |
| `public/icon-512x512.png`     | Manifest / 512 × 512         |
| `public/apple-touch-icon.png` | Apple ホーム画面 / 180 × 180 |
| `src/app/favicon.ico`         | ブラウザタブ                 |

現在のアイコンは `purpose: "any"` です。Android 用の maskable アイコンを追加する場合は、専用のセーフエリアを確保した別画像を用意して Manifest に追加してください。インストール済みのアイコン更新はブラウザ・OS の更新タイミングに依存するので、差し替え確認は再インストールでも行ってください。

### 動作確認

```bash
pnpm test --run
pnpm build
pnpm start
```

自動テストではインストール案内・ブラウザイベント・起動先復帰、Manifest の必須項目、PNG の実寸と宣言寸法、テナントのルーティングを確認します。OS が管理するインストール確認画面は実機で確認してください。
1. Chrome / Edge と Android Chrome、iPhone / iPad Safari で対象テナントのゲストページを開き、インストールボタンの案内に従って追加できることを確認します。
2. ホーム画面やアプリ一覧から起動し、ブラウザのアドレスバーがないアプリ表示と、インストールしたページからの初回起動を確認します。Cookie / localStorage が引き継がれない環境でも起動先が保たれることを確認します。
3. ゲスト、管理、グラフ編集、観測、端末別観測の各公開 URL をアプリ内で開き、画面表示・ページ遷移・オンライン API・既存操作が動作することを確認します。観測はカメラ権限と既存のモデル / API 設定も必要です。
4. ページを再読み込みしても動作し、アプリ内ではインストールボタンが非表示であることを確認します。
5. 開発者ツールの Application → Manifest でエラーがなく、ルートとテナント両方の `/manifest.webmanifest` と各アイコンが 200 で配信されることを確認します。
6. macOS Safari の Dock 追加、確認画面をキャンセルした場合、インストール非対応のブラウザでも案内が表示されることを確認します。オフライン動作は確認対象外です。

参考: [Next.js PWA ガイド](https://nextjs.org/docs/app/guides/progressive-web-apps)、[MDN: Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)。
