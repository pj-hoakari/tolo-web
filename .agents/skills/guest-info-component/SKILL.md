---
name: guest-info-component
description: src/features/guest/info に新しい GuestInfoComponent（ゲストページに並べる情報ウィジェット）を追加するときの手順とルール。View とラッパー（API 呼び出し）の分割、defineGuestInfoComponent による id 付き宣言、GuestInfoComponent 型による呼び出し制限、src/stories への Storybook ファイル追加を扱う。「待ち人数」のような情報パーツを増やすときに使う。
---

# GuestInfoComponent の追加

`src/features/guest/info` 配下に、ゲストページへ並べる情報ウィジェット（`GuestInfoComponent`）を1つ追加するときの手順。

## このアーキテクチャの背景

ゲストページでは「待ち人数」などの情報パーツを縦に並べて表示する。これらのパーツを受け取って並べる側のコンポーネント（コンテナなど）では、**`src/features/guest/info` 内で正しく定義されたコンポーネントだけ**を受け取れるように制限したい。

ただしこれは「`src/features/guest/info` ディレクトリにあるか」というパスベースの制限ではなく、**型による制限**で実現する。具体的には、非公開の `unique symbol`（ブランド）を使った nominal typing を用いる。

- `src/features/guest/info/type.ts` の `guestInfoBrand` は **export していない** `unique symbol`。
- `GuestInfoComponent` 型はこのブランドキーを持つ必要があるため、外部モジュールからは構築できず、**必ず `defineGuestInfoComponent` を経由**しないとこの型の値を作れない。
- 同じ `props`（`{ tenantId, eventId }`）を取る素のコンポーネントを書いても、ブランドが無いので `GuestInfoComponent` には代入できない（型エラー）。
- ブランドシンボルの **値そのものが id**（一覧表示の `key` 等に使う識別子）になっている。id の読み出しは `getGuestInfoComponentId` アクセサ経由で行う。

この仕組みにより、「guest/info の作法で作られたコンポーネントだけを並べる」という制約をコンパイル時に保証している。

## 全体像（1パーツ = 3つの責務）

1. **View コンポーネント** … 受け取った値を描画するだけのプレゼンテーション。API もブランドも知らない。Storybook の対象。
2. **ラッパーコンポーネント** … API を呼んでデータを取得し、View に渡す。`defineGuestInfoComponent` で id を付けて `GuestInfoComponent` として default export する。
3. **Storybook** … View コンポーネントの story を `src/stories` に置く。

View とラッパーは**必ず分ける**こと。View を純粋な描画に保つことで、Storybook で状態網羅でき、ラッパー側の API 都合と切り離せる。

## 手順

例として `Foo` というパーツを追加する場合（既存の `WaitingNumber` が参照実装）。

### 1. View コンポーネント

`src/features/guest/info/FooView.tsx`

```tsx
export type FooViewProps = {
  // View が描画に必要とする値だけを受け取る（tenantId / eventId は受け取らない）
  value: number;
};

export function FooView({ value }: FooViewProps) {
  return (
    <div className="flex flex-col items-center justify-center">
      <h1 className="text-xl mb-4">Foo</h1>
      <p className="text-lg">{value}</p>
    </div>
  );
}
```

- API・`tenantId`・`eventId`・ブランドには一切依存しない。
- props は描画に必要な値だけ。

### 2. ラッパー（API 呼び出し）コンポーネント

`src/features/guest/info/Foo.tsx`

```tsx
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";
import { FooView } from "./FooView";

function Foo({ tenantId, eventId }: GuestInfoComponentProps) {
  // TODO: tenantId / eventId を使って API からデータを取得する
  const value = 0;

  return <FooView value={value} />;
}

// defineGuestInfoComponent で **ユニークな id** を指定して GuestInfoComponent にする。
export default defineGuestInfoComponent("foo", Foo);
```

- props は必ず `GuestInfoComponentProps`（`{ tenantId, eventId }`）。
- `defineGuestInfoComponent(id, component, options?)` の **第1引数 id は他のパーツと重複しないユニークな文字列**（一覧の `key` に使われる。kebab-case 推奨、例: `"waiting-number"`）。
- default export は **必ず `defineGuestInfoComponent` の戻り値**にする。素のコンポーネントを export すると `GuestInfoComponent` 型として扱えず、並べる側で弾かれる。
- **グリッド上の幅は `options.span` で宣言する**（並べる側は 2 列グリッド）。既定は `2`（`col-span-2` = 1 行全体）。横に 2 つ並べたい小さいパーツは `{ span: 1 }`（`col-span-1`）を指定する。例: `defineGuestInfoComponent("floor", Floor, { span: 1 })`。レイアウト幅はパーツ自身の責務として持たせ、並べる側（ページ）はフラットな `GuestInfoComponent[]` に並び順だけを書く。

### 3. Storybook（View の story）

`src/stories/FooView.stories.ts`

```ts
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FooView } from "@/features/guest/info/FooView";

const meta = {
  title: "Guest/Info/Foo",
  component: FooView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    value: { control: { type: "number", min: 0 } },
  },
} satisfies Meta<typeof FooView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 5,
  },
};
```

- story は **ラッパーではなく View** を対象にする（API に依存しないため）。
- 置き場所は `src/stories/<ViewName>.stories.ts`（例: `src/stories/WaitingNumberView.stories.ts`）。JSX を書かなければ拡張子は `.ts` でよい。
- 型は `@storybook/nextjs-vite` から import。`title` は `Guest/Info/<Name>` の階層に揃える。
- 代表値だけでなく、空（0）や多い場合などの状態も story にしておくとよい。

## 呼び出し（利用）側

`GuestInfoComponent` を受け取って並べる側は、props を `GuestInfoComponent[]` 型で要求する。これにより **`defineGuestInfoComponent` を通したコンポーネント以外はコンパイル時に弾かれる**。利用箇所を増やす場合も、この型で受け取る限り同じ制限がかかる。

```tsx
import {
  type GuestInfoComponent,
  getGuestInfoComponentId,
} from "@/features/guest/info/type";

// 並べたいパーツを列挙するだけ。id は各コンポーネントが持っている。
const components: GuestInfoComponent[] = [Foo /*, ...他のパーツ */];

// 描画側では key を getGuestInfoComponentId で取り出す
components.map((Component) => (
  <Component key={getGuestInfoComponentId(Component)} tenantId={tenantId} eventId={eventId} />
));
```

- 受け取る型を `GuestInfoComponent[]` にすることが制限の本体。素のコンポーネントや、props 形状だけ合わせたコンポーネントは代入できない。
- `key` などに使う id は `getGuestInfoComponentId(Component)` で取得する（id はブランドシンボルに隠蔽されているため直接アクセスしない）。span は `getGuestInfoComponentSpan(Component)` で取得し `col-span-1` / `col-span-2` を出し分ける。
- **ブランド（id / span）を読む側はクライアントコンポーネントにする**。ブランドは `defineGuestInfoComponent` の `Object.assign` で**クライアントバンドル側**のコンポーネント関数に付与される。各パーツ（`"use client"`）をサーバーコンポーネントから読むと client reference 化されてブランドが見えず、`getGuestInfoComponentId` / `getGuestInfoComponentSpan` が `undefined` を返す（key 重複・`reading 'span'` クラッシュの原因）。リスト自体はサーバー（ページ）で組み立てて `components` prop として注入してよい（クライアントで解決される際にブランドは復元される）が、**読み出す並べる側コンポーネントには `"use client"` を付ける**こと。

## チェックリスト

- [ ] `src/features/guest/info/<Name>View.tsx` … 純粋な View（API / tenantId / eventId に非依存）
- [ ] `src/features/guest/info/<Name>.tsx` … ラッパー。`GuestInfoComponentProps` を受け、`defineGuestInfoComponent("<unique-id>", <Name>)` を default export
- [ ] id が既存パーツと重複していない
- [ ] `src/stories/<Name>View.stories.ts` … View の story（`title: "Guest/Info/<Name>"`）
- [ ] 並べる側へは `GuestInfoComponent[]` として渡している（id は `getGuestInfoComponentId` で取得）
- [ ] `pnpm lint`（biome）と `pnpm typecheck`（tsc）が通る
