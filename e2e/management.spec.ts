import { expect, type Page, test } from "@playwright/test";

const pointA = "入口";
const pointB = "ブース前";
const offlinePoint = "ホール";
const panel = (page: Page) => page.getByRole("complementary");
const observationPoint = (page: Page, name: string) =>
  panel(page).getByRole("group", { name: "観測点" }).getByText(name);
const emptyNotice = "観測点を紐づけるポイントまたはルートを選択してください。";
const booth = (page: Page) => page.getByTestId("rf__node-ph_booth");
const nodeTransform = (page: Page, id: string) =>
  page
    .getByTestId(`rf__node-${id}`)
    .evaluate((el: HTMLElement) => el.style.transform);

test.beforeEach(async ({ page }) => {
  await page.goto("/event/test/management");
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "0123456789abcdef 管理ページ",
    }),
  ).toBeVisible();
});

test("管理ページを開くとルート図が表示される", async ({ page }) => {
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(booth(page)).toBeVisible();
  await expect(panel(page)).toContainText(emptyNotice);
});

test("管理ページの観測デバイス管理リンクを押すと観測デバイス管理ページに移動する", async ({
  page,
}) => {
  await page.getByRole("link", { name: "観測デバイス管理" }).click();
  await expect(page).toHaveURL("/event/test/observation");
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "0123456789abcdef 観測デバイス管理",
    }),
  ).toBeVisible();
});

test("グラフを編集リンクを押すとルート図編集ページに移動する", async ({
  page,
}) => {
  await page.getByRole("link", { name: "グラフを編集" }).click();
  await expect(page).toHaveURL("/event/test/management/graph/edit");
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "0123456789abcdef ルート図編集",
    }),
  ).toBeVisible();
});

test("ポイントを選ぶとそのポイントの情報と稼働中の観測点が表示される", async ({
  page,
}) => {
  await booth(page).click();

  await expect(panel(page).getByRole("code")).toHaveText("ph_booth");
  await expect(panel(page)).toContainText("ブースA");
  await expect(
    panel(page).getByRole("checkbox", { name: pointA }),
  ).toBeVisible();
  await expect(
    panel(page).getByRole("checkbox", { name: pointB }),
  ).toBeVisible();
  await expect(
    panel(page).getByRole("checkbox", { name: offlinePoint }),
  ).toHaveCount(0);
});

test("ルートを選ぶとそのルートの ID と端点が表示される", async ({ page }) => {
  await page.getByTestId("rf__edge-ph_e2").click({ force: true });

  await expect(panel(page).getByRole("code")).toHaveText("ph_e2");
  await expect(panel(page)).toContainText("エントランスホール⇌ブースA");
});

for (const { target, select } of [
  {
    target: "外部ポイント",
    select: (page: Page) => page.getByTestId("rf__node-external").click(),
  },
  {
    target: "グループ",
    select: async (page: Page) => {
      const group = page.getByTestId("rf__node-ph_floor1");
      const box = await group.boundingBox();
      if (!box) throw new Error("group is not visible");
      await group.click({
        position: { x: box.width - 10, y: box.height - 10 },
      });
    },
  },
]) {
  test(`${target}を選んでも観測点の紐づけ対象にならない`, async ({ page }) => {
    await select(page);

    await expect(panel(page)).toContainText(emptyNotice);
    await expect(panel(page).getByRole("checkbox")).toHaveCount(0);
  });
}

test("ルートに観測点を紐づけるとポイント側ではその観測点が使用中になる", async ({
  page,
}) => {
  await page.getByTestId("rf__edge-ph_e2").click({ force: true });
  await observationPoint(page, pointA).click();
  await expect(
    panel(page).getByRole("checkbox", { name: pointA }),
  ).toBeChecked();

  await booth(page).click();

  await expect(
    panel(page).getByRole("checkbox", {
      name: `${pointA} 他のポイント / ルートで使用中`,
    }),
  ).toBeDisabled();
});

test("観測点の紐づけを外すと他のポイントで再び選べる", async ({ page }) => {
  await booth(page).click();
  await observationPoint(page, pointA).click();
  await observationPoint(page, pointA).click();
  await expect(
    panel(page).getByRole("checkbox", { name: pointA }),
  ).not.toBeChecked();

  await page.getByTestId("rf__node-ph_wall").click();

  await expect(
    panel(page).getByRole("checkbox", { name: pointA }),
  ).toBeEnabled();
});

test("表示専用のルート図ではポイントを動かせず削除や右クリックの操作もできない", async ({
  page,
}) => {
  const before = await nodeTransform(page, "ph_booth");
  const box = await booth(page).boundingBox();
  if (!box) throw new Error("booth is not visible");
  await page.mouse.move(box.x + 16, box.y + 16);
  await page.mouse.down();
  await page.mouse.move(box.x + 216, box.y + 116, { steps: 10 });
  await page.mouse.up();
  expect(await nodeTransform(page, "ph_booth")).toBe(before);

  await booth(page).click();
  await page.keyboard.press("Delete");
  await expect(booth(page)).toBeVisible();

  await booth(page).click({ button: "right" });
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Toggle Interactivity" }),
  ).toHaveCount(0);
});

test("ポイントにキーボードでフォーカスして Enter を押すとそのポイントが選ばれる", async ({
  page,
}) => {
  await booth(page).focus();
  await page.keyboard.press("Enter");

  await expect(panel(page).getByRole("code")).toHaveText("ph_booth");
});

test("ルートにキーボードでフォーカスして Enter を押すとそのルートが選ばれる", async ({
  page,
}) => {
  await page.getByTestId("rf__edge-ph_e2").focus();
  await page.keyboard.press("Enter");

  await expect(panel(page).getByRole("code")).toHaveText("ph_e2");
});

test("キーボードで選んだポイントで Escape を押すと選択が解除される", async ({
  page,
}) => {
  await booth(page).focus();
  await page.keyboard.press("Enter");
  await expect(panel(page).getByRole("code")).toHaveText("ph_booth");

  await page.keyboard.press("Escape");

  await expect(panel(page)).toContainText(emptyNotice);
});

test("ポイントに観測点を紐づけると観測点の件数が表示される", async ({
  page,
}) => {
  await booth(page).click();
  await observationPoint(page, pointA).click();

  await expect(
    panel(page).getByRole("checkbox", { name: pointA }),
  ).toBeChecked();
  await expect(panel(page)).toContainText("観測点（1）");
});

test("あるポイントに紐づけた観測点は他のポイントでは使用中として選べない", async ({
  page,
}) => {
  await booth(page).click();
  await observationPoint(page, pointA).click();

  await page.getByTestId("rf__node-ph_wall").click();

  await expect(
    panel(page).getByRole("checkbox", {
      name: `${pointA} 他のポイント / ルートで使用中`,
    }),
  ).toBeDisabled();
  await expect(
    panel(page).getByRole("checkbox", { name: pointB }),
  ).toBeEnabled();
});

test("ラベルの言語を English に切り替えるとポイントのラベルが英語で表示される", async ({
  page,
}) => {
  await page.getByRole("button", { name: "ラベルの言語" }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();

  await expect(booth(page)).toContainText("Booth A");
  await expect(
    page.getByRole("button", { name: "ラベルの言語（English）" }),
  ).toBeVisible();
});
