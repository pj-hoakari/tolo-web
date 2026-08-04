---
name: i18n-messages
description: 画面に出る文言（ラベル・見出し・ボタン・aria-label・エラーメッセージ等）を追加・変更するときの next-intl の手順とルール。messages/*.json への 7 ロケール追加、useTranslations / getTranslations の使い分け、View とラッパーの文言の持ち方、ロジック層がメッセージキーだけを持つ設計、動的キーの型付け、テスト・Storybook での Provider、対応ロケールの増減を扱う。新しいテキストを画面に出すとき、日本語がハードコードされている箇所を直すときに使う。
---

# 文言の追加・変更（next-intl）

このプロジェクトの画面文言はすべて next-intl で管理する。**JSX・`aria-label`・`title`・エラーメッセージに文字列リテラルを直接書かない。**

## 現在の構成

| 場所 | 役割 |
|---|---|
| `messages/<locale>.json` | ロケールごとのメッセージ。**7 ファイル**（`ja` / `en` / `ko` / `zh-Hans` / `zh-Hant` / `es` / `ne`） |
| `src/i18n/locale.ts` | `locales` / `defaultLocale`（`ja`）/ `Locale` 型 / `localeLabels` / `isLocale` / `resolveLocaleFromAcceptLanguage` |
| `src/i18n/request.ts` | ロケール解決。**Cookie（ユーザーの明示選択）→ Accept-Language → 既定ロケール** の順 |
| `src/i18n/cookie.ts` / `actions.ts` | `NEXT_LOCALE` Cookie の定数と保存用 Server Action（host-only Cookie） |
| `src/components/locale-select.tsx` / `locale-select-view.tsx` | 言語セレクタ（ラッパー + View） |
| `global.d.ts` | `messages/ja.json` を基準にした型宣言（`AppConfig`） |
| `src/test/IntlTestProvider.tsx` | ユニットテスト用の Provider ラッパー |
| `.storybook/preview.tsx` / `messages.ts` | Storybook の Provider と Locale ツールバー |

**`messages/ja.json` が型の基準**。新しいキーは ja に足してから他ロケールへ展開する。

## 手順

### 1. メッセージを 7 ファイルすべてに追加する

名前空間は画面・機能単位で切る（既存: `Theme` / `Management` / `Graph` / `Webrtc` / `Detection` / `Observation` / `Guest` / `LocaleSelect`）。

```jsonc
// messages/ja.json
{
  "Observation": {
    "controls": { "start": "カメラを起動", "stop": "停止" },
    "status": { "trackedCount": "追跡中人数: {count}人" }
  }
}
```

- 値の埋め込みは ICU の `{name}`。数値を渡すとロケールに応じて桁区切りが入る。
- 7 ファイルの**キー構造は完全に一致させる**。1つでも欠けると `pnpm typecheck` が `.storybook/messages.ts` で落ちる（`satisfies Record<Locale, Messages>` による検証）。
- ファイル数が多いので、まとめて追記するスクリプトを一時ファイルとして書いて流し込み、最後に `pnpm check:fix messages` で整形するのが速い。

### 2. コンポーネントから引く

```tsx
// クライアント / 同期のサーバーコンポーネント
import { useTranslations } from "next-intl";

const t = useTranslations("Observation.controls");
<Button>{t("start")}</Button>;
```

```tsx
// async なサーバーコンポーネント（page.tsx など）はフックを使えない
import { getTranslations } from "next-intl/server";

const t = await getTranslations("Observation");
<h2>{t("title", { tenantId })}</h2>;
```

- 名前空間はドットで深く指定できる（`useTranslations("Graph.observationPoints")`）。
- `aria-label` / `title` / `textValue` などの**支援技術向けの文字列も必ず翻訳対象**。
- `t()` はフックなので、`useCallback` の依存配列に `t` を入れる。

### 3. View とラッパーの分担

このリポジトリでは **View（表示専用）は文言を props で受け取り、ラッパーが翻訳して渡す**。

```tsx
// FooView.tsx（View）: 翻訳を知らない。省略時の既定値は日本語でよい（Storybook 用）
export function FooView({ label = "現在の待ち人数" }: FooViewProps) { … }

// Foo.tsx（ラッパー）: ここで翻訳する
const t = useTranslations("Guest.waitingNumber");
return <FooView label={t("title")} />;
```

- View に `useTranslations` を持たせない。Storybook で状態を網羅しづらくなる。
- View の props 既定値に日本語が残るのは意図的（ラッパーが必ず渡すのでアプリには出ない）。
- Server Action を import するコンポーネントは Storybook で描画できない。`LocaleSelect` / `LocaleSelectView` のように **UI と副作用を分割**すること。

### 4. ロジック層は文言を持たず「キー」を持つ

ユーティリティ・純粋関数・ストア・型定義に表示文字列を置かない。**メッセージキーを返し、描画境界で翻訳する。**

参考実装:

- `src/features/tenant/management/graph/nodeTypes.ts`
  検証結果・通知が `messageKey` を持ち、`NoticeTranslator`（`useTranslations("Graph.notices")` をそのまま渡せる関数型）を引数で注入する。
  ```ts
  export type NoticeMessageKey = keyof Messages["Graph"]["notices"];
  export type NoticeTranslator = (messageKey: NoticeMessageKey) => string;
  ```
- `src/features/tenant/observation/utils/detectCrowd.ts`
  失敗理由を `DetectionModelLoadError`（`status` / `path` を保持）で投げ、`useDetectCrowd` 側で `t("errors.modelLoad", { status, path })` に組み立てる。
- `src/features/tenant/webrtc/utils/connectionStatus.ts`
  かつて日本語ラベルの `Record` を持っていたが削除。描画側が `t(status)` で引く。

### 5. 日時・数値のフォーマット

ロケール文字列をハードコードしない。

```tsx
const locale = useLocale();
lastSeenAt.toLocaleTimeString(locale); // ✗ "ja-JP" 固定
```

`useFormatter()` を使う場合は `timeZone` の扱いに注意（未設定だと実行環境依存になる）。Storybook とユニットテストの Provider は `Asia/Tokyo` で固定している。

## 動的なキーの型付け

`global.d.ts` によりキーは型検査される。テンプレートリテラルでキーを組み立てる場合、**変数が `string` のままだと型エラーになる**。キー一覧をコードに二重定義せず、メッセージ型から union を導出する。

```ts
import type { Messages } from "next-intl";

type AreaId = keyof Messages["Guest"]["congestion"]["areas"];
type RawArea = { id: AreaId; level: CongestionLevel };

t(`areas.${area.id}`); // ✅ 型が通る
```

外部データ由来で id を型に落とせない場合（例: マップ作成ツールが書き出す JSON）に限り、キー型へキャストし **`t.has()` で実在を確認**してから使う。理由をコメントで残すこと（`src/features/guest/info/GuideMap.tsx` が参照実装）。

## テスト

`useTranslations` を使うコンポーネント / フックは Provider 配下でないと実行時に落ちる。`src/test/IntlTestProvider.tsx`（ja メッセージ）を使う。

```tsx
import { IntlTestProvider } from "@/test/IntlTestProvider";

const renderWithIntl = (ui: ReactElement) =>
  render(ui, { wrapper: IntlTestProvider });

// フックの場合
renderHook(() => useGraphEditor(initial), { wrapper: IntlTestProvider });
```

既定ロケールが ja なので、**アサーションは日本語の文言のまま書ける**。

## Storybook

`.storybook/preview.tsx` の decorator が `NextIntlClientProvider` を張るので、story 側の対応は不要。ツールバーの **Locale** で全ロケールを切り替えて確認できる。

- 特定 story だけロケールを変えたいときは `globals: { locale: "ko" }` を指定する。
- 新しいロケールを増やしたら `.storybook/messages.ts` の import とマップにも追加する（漏れは `satisfies` で型エラーになる）。

## 対応ロケールを増やす / 減らすとき

1. `src/i18n/locale.ts` の `locales` と `localeLabels`（**自称表記**で固定）を更新
2. `messages/<locale>.json` を追加（ja と同じキー構造）
3. `.storybook/messages.ts` に import とエントリを追加
4. 中国語のように表記体系で分ける場合は `resolveLocaleFromAcceptLanguage` の判定（script / region サブタグ）も確認し、`src/i18n/locale.test.ts` にケースを足す

## やらないこと（意図的に日本語のまま）

- `guideMapData.json` などの**外部ツールが書き出したデータ**の名称（データ側の多言語化が必要）
- `placeholderGraph.ts` のサンプルノード名
- View コンポーネントの props 既定値、コード内のコメント

将来 API から来るダミーデータの文言は、`Record<Lang, string>` のように**言語別フィールドで持たせない**。ロケールが増えたときに破綻する。`Guest.congestion.areas.<id>` のように **id をキーにしてメッセージ側へ寄せる**（`Congestion.tsx` / `StaffMessageBell.tsx` が参照実装）。

## チェックリスト

- [ ] `messages/*.json` **7 ファイルすべて**に同じキーを追加した
- [ ] 新規キーは `messages/ja.json` にも入っている（型の基準）
- [ ] JSX・`aria-label`・`title`・エラーメッセージに日本語リテラルが残っていない
- [ ] View ではなくラッパー側で翻訳している
- [ ] ユーティリティ・ストア・型定義が表示文字列ではなくキーを持っている
- [ ] 日時・数値のロケールをハードコードしていない（`useLocale()` / `useFormatter()`）
- [ ] 動的キーはメッセージ型から導出した union にした（キャストしたなら `t.has()` と理由コメント付き）
- [ ] `useTranslations` を使うコンポーネントのテストを `IntlTestProvider` で包んだ
- [ ] `pnpm typecheck` / `pnpm check` / `pnpm test:all` が通る
- [ ] 実ブラウザで最低 2 ロケール（例: ja と en）を切り替えて確認した
