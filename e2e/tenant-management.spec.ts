import { expect, type Page, test } from "@playwright/test";

const eventList = (page: Page) => page.getByRole("main").getByRole("list");
const eventRow = (page: Page, name: string) =>
  eventList(page).getByRole("listitem").filter({ hasText: name });
const archiveButton = (page: Page, name: string) =>
  eventRow(page, name).getByRole("button", { name: "アーカイブ" });

test.beforeEach(async ({ page }) => {
  await page.goto("/management");
  await expect(
    page.getByRole("heading", { level: 2, name: "test イベント管理" }),
  ).toBeVisible();
});

test("テナントのイベントが状態とともに一覧に表示される", async ({ page }) => {
  await expect(eventList(page).getByRole("listitem")).toHaveCount(4);
  await expect(eventRow(page, "Event A")).toContainText("下書き");
  await expect(eventRow(page, "Event B")).toContainText("公開中");
  await expect(eventRow(page, "Event C")).toContainText("ロック中");
  await expect(eventRow(page, "Event D")).toContainText("終了");
  await expect(
    eventRow(page, "Event A").getByRole("link", { name: "Event A" }),
  ).toHaveAttribute("href", "/event/0000000000000001/management");
});

test("イベント名を入力して作成すると一覧に下書きとして追加され入力欄が空になる", async ({
  page,
}) => {
  const field = page.getByRole("textbox", { name: "イベント名" });
  await field.fill("Event E");
  await page.getByRole("button", { name: "作成" }).click();

  await expect(eventRow(page, "Event E")).toContainText("下書き");
  await expect(eventList(page).getByRole("listitem")).toHaveCount(5);
  await expect(field).toHaveValue("");
});

test("下書きのイベントをダイアログで確認してアーカイブすると一覧から消える", async ({
  page,
}) => {
  await archiveButton(page, "Event A").click();
  const dialog = page.getByRole("alertdialog", {
    name: "イベントをアーカイブ",
  });
  await expect(dialog).toContainText("「Event A」をアーカイブします。");

  await dialog.getByRole("button", { name: "アーカイブする" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(eventRow(page, "Event A")).toHaveCount(0);
  await expect(eventList(page).getByRole("listitem")).toHaveCount(3);
});

test("アーカイブのダイアログをキャンセルするとイベントは一覧に残る", async ({
  page,
}) => {
  await archiveButton(page, "Event D").click();
  await page.getByRole("button", { name: "キャンセル" }).click();

  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(eventRow(page, "Event D")).toBeVisible();
});

test("公開中とロック中のイベントにはアーカイブボタンが表示されない", async ({
  page,
}) => {
  await expect(eventRow(page, "Event B")).toBeVisible();
  await expect(archiveButton(page, "Event B")).toHaveCount(0);
  await expect(archiveButton(page, "Event C")).toHaveCount(0);
  await expect(archiveButton(page, "Event D")).toBeVisible();
});
