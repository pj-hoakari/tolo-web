import { expect, type Page, test } from "@playwright/test";

const search = (page: Page) =>
  page.getByRole("textbox", { name: "目的地を検索" });
const reset = (page: Page) => page.getByRole("button", { name: "リセット" });
const searchToolbar = (page: Page) =>
  page
    .locator("div")
    .filter({ has: search(page) })
    .filter({ has: reset(page) })
    .last();
const localeButton = (page: Page) =>
  page.getByRole("button", { name: "言語を切り替え" });
const themeButton = (page: Page) =>
  page.getByRole("button", { name: "テーマを切り替え" });

test.beforeEach(async ({ page }) => {
  await page.goto("/event/test/guest");
  await expect(
    page.getByRole("heading", { level: 1, name: "test" }),
  ).toBeVisible();
});

test("ゲストページを開くと各情報セクションの見出しが表示される", async ({
  page,
}) => {
  for (const title of [
    "案内マップ",
    "現在のフロア",
    "現在の呼び出し番号",
    "推定待ち時間",
    "現在の待ち人数",
    "行列の並び方",
    "混雑状況",
  ]) {
    await expect(
      page.getByRole("heading", { level: 2, name: title }),
    ).toBeVisible();
  }
});

test("お知らせボタンを押すとスタッフからのお知らせ一覧が開き未読バッジが消える", async ({
  page,
}) => {
  const bell = page.getByRole("button", { name: "スタッフからのお知らせ" });
  await expect(bell).toHaveText("2");
  await expect(bell).toHaveAttribute("aria-expanded", "false");

  await bell.click();

  await expect(bell).toHaveAttribute("aria-expanded", "true");
  await expect(bell).not.toHaveText("2");
  const list = page.getByRole("banner").getByRole("list");
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list).toContainText("東ゲート付近が大変混雑しています。");
  await expect(list).toContainText("06/15 14:30");
});

test("お知らせ一覧はキーボードで開いて閉じられる", async ({ page }) => {
  const bell = page.getByRole("button", { name: "スタッフからのお知らせ" });
  await bell.focus();
  await page.keyboard.press("Enter");

  await expect(bell).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("heading", { level: 2, name: "スタッフからのお知らせ" }),
  ).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "お知らせを閉じる" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(bell).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("banner").getByRole("list")).toBeHidden();
});

test("お知らせ一覧は Escape で閉じる", async ({ page }) => {
  test.fail();
  const bell = page.getByRole("button", { name: "スタッフからのお知らせ" });
  await bell.click();
  await expect(bell).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("Escape");

  await expect(bell).toHaveAttribute("aria-expanded", "false");
});

test("お知らせ一覧の外側を押すとお知らせ一覧が閉じる", async ({ page }) => {
  await page.getByRole("button", { name: "スタッフからのお知らせ" }).click();
  await page
    .getByRole("button", { name: "お知らせを閉じる" })
    .click({ position: { x: 5, y: 5 } });

  await expect(page.getByRole("banner").getByRole("list")).toBeHidden();
  const bell = page.getByRole("button", { name: "スタッフからのお知らせ" });
  await expect(bell).toHaveAttribute("aria-expanded", "false");
  await expect(bell).not.toHaveText("2");
});

test("目的地を検索すると名前に検索語を含む目的地だけが候補に出る", async ({
  page,
}) => {
  await search(page).fill("焼き");

  for (const name of ["たこ焼き", "焼きそば", "お好み焼き"]) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "唐揚げ" })).toHaveCount(0);
});

test("検索の候補から目的地を選ぶと検索欄が空になり選んだ目的地が表示される", async ({
  page,
}) => {
  await search(page).fill("たこ");

  await page.getByRole("button", { name: "たこ焼き" }).click();

  await expect(search(page)).toHaveValue("");
  await expect(
    searchToolbar(page).getByText("たこ焼き", { exact: true }),
  ).toBeVisible();
});

test("目的地の検索欄で Enter を押すと先頭の候補が選ばれ検索欄が空になる", async ({
  page,
}) => {
  await search(page).fill("焼き");
  await search(page).press("Enter");

  await expect(search(page)).toHaveValue("");
  await expect(
    searchToolbar(page).getByText("たこ焼き", { exact: true }),
  ).toBeVisible();
});

test("一致しない語で Enter を押しても目的地は選ばれない", async ({ page }) => {
  await search(page).fill("zzz");
  await search(page).press("Enter");

  await expect(search(page)).toHaveValue("zzz");
  await expect(page.getByText("見つかりませんでした")).toBeVisible();
  await expect(reset(page)).toHaveCount(0);
});

test("検索欄を空にすると候補と見つからなかった旨の表示が消える", async ({
  page,
}) => {
  await search(page).fill("焼き");
  await expect(page.getByRole("button", { name: "たこ焼き" })).toBeVisible();
  await search(page).fill("");
  await expect(page.getByRole("button", { name: "たこ焼き" })).toHaveCount(0);

  await search(page).fill("zzz");
  await expect(page.getByText("見つかりませんでした")).toBeVisible();
  await search(page).fill("");
  await expect(page.getByText("見つかりませんでした")).toHaveCount(0);
});

test("目的地を選んだあと再び検索すると選択表示が隠れ検索欄を空にすると再び出る", async ({
  page,
}) => {
  await search(page).fill("たこ");
  await page.getByRole("button", { name: "たこ焼き" }).click();
  await expect(reset(page)).toBeVisible();

  await search(page).fill("焼き");
  await expect(reset(page)).toHaveCount(0);

  await search(page).fill("");
  await expect(reset(page)).toBeVisible();
});

test("選んだ目的地をリセットすると選択が解除される", async ({ page }) => {
  await search(page).fill("たこ");
  await page.getByRole("button", { name: "たこ焼き" }).click();

  await reset(page).click();

  await expect(reset(page)).toBeHidden();
});

test("一致しない語で目的地を検索すると見つからなかったことが表示される", async ({
  page,
}) => {
  await search(page).fill("zzz");
  await expect(page.getByText("見つかりませんでした")).toBeVisible();
});

test("地図を拡大すると縮小ボタンに切り替わり縮小すると元に戻る", async ({
  page,
}) => {
  await page.getByRole("button", { name: "地図を拡大" }).click();
  await page.getByRole("button", { name: "地図を縮小" }).click();
  await expect(page.getByRole("button", { name: "地図を拡大" })).toBeVisible();
});

test("言語を English に切り替えると英語で表示され再読み込み後も維持される", async ({
  page,
}) => {
  await localeButton(page).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();

  await expect(
    page.getByRole("heading", { level: 2, name: "Guide map" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.reload();
  await expect(page.getByText("Guest Page")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("言語メニューを開くと 7 つの言語が並び現在の日本語が選ばれている", async ({
  page,
}) => {
  await localeButton(page).click();

  await expect(page.getByRole("menuitemradio")).toHaveCount(7);
  await expect(
    page.getByRole("menuitemradio", { name: "日本語" }),
  ).toHaveAttribute("aria-checked", "true");
});

test("言語メニューは Escape で閉じフォーカスがボタンに戻る", async ({
  page,
}) => {
  await localeButton(page).click();
  await expect(page.getByRole("menu")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(localeButton(page)).toBeFocused();
});

test("キーボードだけで言語を English に切り替えられる", async ({ page }) => {
  await localeButton(page).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("menuitemradio", { name: "日本語" }),
  ).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitemradio", { name: "English" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("テーマをダークに切り替えるとダークテーマが適用され再読み込み後も維持される", async ({
  page,
}) => {
  await themeButton(page).click();
  await page.getByRole("menuitemradio", { name: "ダーク" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
});

test("テーマをライトに切り替えるとダークテーマが外れる", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await themeButton(page).click();
  await page.getByRole("menuitemradio", { name: "ライト" }).click();

  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
});

test("テーマがシステムのときは OS の配色設定に従う", async ({ page }) => {
  await themeButton(page).click();
  await expect(
    page.getByRole("menuitemradio", { name: "システム" }),
  ).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
});
