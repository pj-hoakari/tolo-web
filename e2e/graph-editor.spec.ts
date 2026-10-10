import { expect, type Page, test } from "@playwright/test";

test.use({ viewport: { width: 1600, height: 1000 } });

const panel = (page: Page) => page.getByRole("complementary");
const booth = (page: Page) => page.getByTestId("rf__node-ph_booth");
const selectBooth = (page: Page) =>
  booth(page).click({ position: { x: 8, y: 8 } });
const routeToBooth = (page: Page) => page.getByTestId("rf__edge-ph_e2");

test.beforeEach(async ({ page }) => {
  await page.goto("/event/test/management/graph/edit");
  await expect(
    page.getByRole("heading", { level: 2, name: "test ルート図編集" }),
  ).toBeVisible();
  await expect(booth(page)).toBeVisible();
});

test("管理ページへ戻るリンクを押すと管理ページに移動する", async ({ page }) => {
  await page.getByRole("link", { name: "管理ページへ戻る" }).click();
  await expect(page).toHaveURL("/event/test/management");
  await expect(
    page.getByRole("heading", { level: 2, name: "test 管理ページ" }),
  ).toBeVisible();
});

test("目的地を追加すると新しいポイントが選択された状態でプロパティに表示される", async ({
  page,
}) => {
  await page.getByRole("button", { name: "目的地を追加" }).click();

  await expect(
    panel(page).getByRole("textbox", { name: "ラベル（日本語）" }),
  ).toHaveValue("ポイント 12");
  await expect(
    panel(page).getByRole("radio", { name: /^目的地 例:/ }),
  ).toBeChecked();
  await expect(
    page.getByRole("button", { name: "「ポイント 12」のラベルを編集" }),
  ).toBeVisible();
});

test("グループを追加すると新しいグループが選択された状態でプロパティに表示される", async ({
  page,
}) => {
  await page.getByRole("button", { name: "+ グループを追加" }).click();

  await expect(
    panel(page).getByRole("textbox", { name: "ラベル（日本語）" }),
  ).toHaveValue("グループ 3");
  await expect(
    panel(page).getByRole("button", { name: "グループを解除" }),
  ).toBeVisible();
});

test("プロパティでラベルを書き換えるとキャンバス上のポイントのラベルも変わる", async ({
  page,
}) => {
  await selectBooth(page);
  await panel(page)
    .getByRole("textbox", { name: "ラベル（日本語）" })
    .fill("ブースZ");

  await expect(booth(page)).toContainText("ブースZ");
});

test("ポイントのラベルをその場で編集して Enter を押すとラベルが確定する", async ({
  page,
}) => {
  await page.getByRole("button", { name: "「ブースA」のラベルを編集" }).click();
  await booth(page)
    .getByRole("textbox", { name: "ポイントのラベル（日本語）" })
    .fill("ブースZ");
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("button", { name: "「ブースZ」のラベルを編集" }),
  ).toBeVisible();
});

test("ポイントのラベルをその場で編集して Escape を押すと編集が取り消される", async ({
  page,
}) => {
  await page.getByRole("button", { name: "「ブースA」のラベルを編集" }).click();
  await booth(page)
    .getByRole("textbox", { name: "ポイントのラベル（日本語）" })
    .fill("ブースZ");
  await page.keyboard.press("Escape");

  await expect(
    page.getByRole("button", { name: "「ブースA」のラベルを編集" }),
  ).toBeEnabled();
  await expect(booth(page)).not.toContainText("ブースZ");
});

test("キャンバスの何もない所を右クリックするとキャンバスの操作メニューが開く", async ({
  page,
}) => {
  await page
    .locator(".react-flow__pane")
    .click({ button: "right", position: { x: 20, y: 20 } });

  const menu = page.getByRole("menu", { name: "キャンバスの操作" });
  for (const name of [
    "ポイントを追加",
    "外部ポイントを追加",
    "グループを追加",
    "ルートを追加",
  ]) {
    await expect(
      menu.getByRole("menuitem", { name, exact: true }),
    ).toBeVisible();
  }
});

test("ポイントの操作メニューからポイントを削除するとそのポイントとつながるルートが消える", async ({
  page,
}) => {
  await booth(page).click({ button: "right" });
  await page
    .getByRole("menu", { name: "ポイント「ブースA」の操作" })
    .getByRole("menuitem", { name: "このポイントを削除" })
    .click();

  await expect(booth(page)).toHaveCount(0);
  await expect(routeToBooth(page)).toHaveCount(0);
});

test("ルートの操作メニューで片側通行にするとプロパティの方向が片方向になる", async ({
  page,
}) => {
  await routeToBooth(page).click({ button: "right", force: true });
  await page
    .getByRole("menuitem", {
      name: "片側通行にする（エントランスホール → ブースA）",
    })
    .click();

  await routeToBooth(page).click({ force: true });
  await expect(
    panel(page).getByRole("radio", { name: "片方向 →" }),
  ).toBeChecked();
});

test("ルートの操作メニューからルートを削除するとそのルートが消える", async ({
  page,
}) => {
  await routeToBooth(page).click({ button: "right", force: true });
  await page.getByRole("menuitem", { name: "このルートを削除" }).click();

  await expect(routeToBooth(page)).toHaveCount(0);
  await expect(booth(page)).toBeVisible();
});

test("ポイントを選んで Delete キーを押すとそのポイントが消える", async ({
  page,
}) => {
  await selectBooth(page);
  await page.keyboard.press("Delete");

  await expect(booth(page)).toHaveCount(0);
});

test("最後の外部ポイントは Delete キーを押しても消えない", async ({ page }) => {
  const externals = page.locator(
    '[data-testid="rf__node-external"], [data-testid="rf__node-external-ph_exit"]',
  );
  await expect(externals).toHaveCount(2);

  await page.getByTestId("rf__node-external").click();
  await page.keyboard.press("Delete");
  await expect(externals).toHaveCount(1);

  await page.getByTestId("rf__node-external-ph_exit").click();
  await expect(panel(page).getByRole("code")).toHaveText("external-ph_exit");
  await page.keyboard.press("Delete");

  await expect(page.getByTestId("rf__node-external-ph_exit")).toBeVisible();
});
