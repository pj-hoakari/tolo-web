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
- Manifest の `id`・`scope` は `/` です。各テナントのサブドメインでは、そのサブドメインの全ページが同じアプリ内で開きます。ルートドメインと異なるテナントは別の origin なので、それぞれの URL でインストールしてください。
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

| ファイル | 用途 / 寸法 |
| --- | --- |
| `public/icon-192x192.png` | Manifest / 192 × 192 |
| `public/icon-512x512.png` | Manifest / 512 × 512 |
| `public/apple-touch-icon.png` | Apple ホーム画面 / 180 × 180 |
| `src/app/favicon.ico` | ブラウザタブ |

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
