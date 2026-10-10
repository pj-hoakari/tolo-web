import { expect, test } from "@playwright/test";

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

test("お知らせ一覧の外側を押すとお知らせ一覧が閉じる", async ({ page }) => {
  await page.getByRole("button", { name: "スタッフからのお知らせ" }).click();
  await page
    .getByRole("button", { name: "お知らせを閉じる" })
    .click({ position: { x: 5, y: 5 } });

  await expect(page.getByRole("banner").getByRole("list")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "スタッフからのお知らせ" }),
  ).toHaveAttribute("aria-expanded", "false");
});

test("目的地を検索すると名前に検索語を含む目的地だけが候補に出る", async ({
  page,
}) => {
  await page.getByRole("textbox", { name: "目的地を検索" }).fill("焼き");

  for (const name of ["たこ焼き", "焼きそば", "お好み焼き"]) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "唐揚げ" })).toHaveCount(0);
});

test("検索の候補から目的地を選ぶと検索欄が空になり選んだ目的地が表示される", async ({
  page,
}) => {
  const search = page.getByRole("textbox", { name: "目的地を検索" });
  await search.fill("たこ");

  await page.getByRole("button", { name: "たこ焼き" }).click();

  await expect(search).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "リセット" }).locator(".."),
  ).toHaveText(/^たこ焼き/);
});

test("選んだ目的地をリセットすると選択が解除される", async ({ page }) => {
  await page.getByRole("textbox", { name: "目的地を検索" }).fill("たこ");
  await page.getByRole("button", { name: "たこ焼き" }).click();

  await page.getByRole("button", { name: "リセット" }).click();

  await expect(page.getByRole("button", { name: "リセット" })).toBeHidden();
});

test("一致しない語で目的地を検索すると見つからなかったことが表示される", async ({
  page,
}) => {
  await page.getByRole("textbox", { name: "目的地を検索" }).fill("zzz");
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
  await page.getByRole("button", { name: "言語を切り替え" }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();

  await expect(
    page.getByRole("heading", { level: 2, name: "Guide map" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.reload();
  await expect(page.getByText("Guest Page")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("テーマをダークに切り替えるとダークテーマが適用される", async ({
  page,
}) => {
  await page.getByRole("button", { name: "テーマを切り替え" }).click();
  await page.getByRole("menuitemradio", { name: "ダーク" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
});
