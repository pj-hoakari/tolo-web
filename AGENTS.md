<!-- intent-skills:start -->
## Skill Loading

Before substantial work:
- Skill check: run `pnpm dlx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

## UI コンポーネント（インタラクティブ要素）

ボタン・タブ・トグル・チェックボックス・入力欄など、インタラクティブな HTML 要素を実装・修正するときは以下に従う（スタイル統一と React Aria Components による a11y 確保のため）。

- **React Aria Components ベースで実装する**: 素の `<button>` / `<input>` / `<select>` や、自前の `role="tab"` などの手書き ARIA は使わず、React Aria Components を利用したコンポーネントを使う。
- **`src/components/ui` の共通コンポーネントを優先して使う**: スタイリング済みの共通コンポーネント（`Button`, `Tabs`/`TabList`/`Tab`/`TabPanel`, `Toggle`/`ToggleButtonGroup`, `Checkbox`/`CheckboxGroup`, `TextField`/`Input`/`TextArea`, `Label` など）を使う。
- **`data-` prefix は使わない**: `tailwindcss-react-aria-components` プラグインを導入済みのため、状態スタイルはプラグインの変種で書く。`data-[...]:` を使っている箇所は見つけ次第修正する（**`src/components/ui` 内も含む**）。
  - 主な対応: `data-[hovered]:`→`hover:`、`data-[focused]:`→`focus:`、`data-[focus-visible]:`→`focus-visible:`、`data-[focus-within]:`→`focus-within:`、`data-[selected]:`→`selected:`、`data-[disabled]:`→`disabled:`、`data-[pressed]:`→`pressed:`、`data-[indeterminate]:`→`indeterminate:`、`data-[invalid]:`→`invalid:`、`data-[orientation=vertical]:`→`orientation-vertical:`。グループ版も同様（例: `group-data-[selected]/x:`→`group-selected/x:`）。
  - 注意: `data-hovered`→`hover:`、`data-focused`→`focus:` のように変種名が短くなる（`hovered:` / `focused:` ではない）。
  - 例外: プラグインに変種が無い属性（例: `inert`）は `data-[inert]:` のまま使う。
- **未追加のコンポーネントが必要なときはフィードバックする**: 使いたい React Aria Component が `src/components/ui` に未追加の場合、その場で素の実装に逃げず、「追加が必要なこと」と「使用したい React Aria Component 名」をリストアップして報告する。
- **`src/components/ui` への追加方法**: 共通コンポーネントは JollyUI を shadcn/ui 経由で追加してセットアップしている。ただし**この追加操作（shadcn/ui CLI の実行など）は確認なしに行ってはならない**。必ずユーザーの承認を得てから実行する。
