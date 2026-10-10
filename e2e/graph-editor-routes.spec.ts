import { expect, type Page, test } from "@playwright/test";

test.use({ viewport: { width: 1600, height: 1000 } });

const panel = (page: Page) => page.getByRole("complementary");
const booth = (page: Page) => page.getByTestId("rf__node-ph_booth");
const routeToBooth = (page: Page) => page.getByTestId("rf__edge-ph_e2");
const routeFromEntrance = (page: Page) => page.getByTestId("rf__edge-ph_e1");

test.beforeEach(async ({ page }) => {
  await page.goto("/event/test/management/graph/edit");
  await expect(
    page.getByRole("heading", { level: 2, name: "test ルート図編集" }),
  ).toBeVisible();
  await expect(booth(page)).toBeVisible();
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

test("ルートを選んで Delete キーを押すとそのルートが消える", async ({
  page,
}) => {
  await routeToBooth(page).click({ force: true });
  await expect(panel(page).getByRole("code")).toHaveText("ph_e2");

  await page.keyboard.press("Delete");

  await expect(routeToBooth(page)).toHaveCount(0);
  await expect(booth(page)).toBeVisible();
});

for (const { via, reverse } of [
  {
    via: "プロパティのボタン",
    reverse: (page: Page) =>
      panel(page)
        .getByRole("button", { name: "向きを反転（始点↔終点）" })
        .click(),
  },
  {
    via: "右クリックの操作メニュー",
    reverse: async (page: Page) => {
      await routeFromEntrance(page).click({ button: "right", force: true });
      await page
        .getByRole("menuitem", {
          name: "向きを反転（エントランスホール → 入口）",
        })
        .click();
    },
  },
]) {
  test(`片方向のルートの向きを${via}で反転すると始点と終点が入れ替わる`, async ({
    page,
  }) => {
    await routeFromEntrance(page).click({ force: true });
    await expect(panel(page)).toContainText("入口→エントランスホール");

    await reverse(page);

    await expect(panel(page)).toContainText("エントランスホール→入口");
  });
}

test("両通行のルートでは向きを反転できない", async ({ page }) => {
  await routeToBooth(page).click({ force: true });

  await expect(
    panel(page).getByRole("button", { name: "向きを反転（始点↔終点）" }),
  ).toBeDisabled();
});

test("プロパティで方向を両通行にするとルートの両端に矢印が付く", async ({
  page,
}) => {
  const path = routeFromEntrance(page).locator("path.react-flow__edge-path");
  await expect(path).not.toHaveAttribute("marker-start");
  await routeFromEntrance(page).click({ force: true });

  await panel(page).getByRole("radio", { name: "両通行可 ⇌" }).click();

  await expect(path).toHaveAttribute("marker-start", /^url\(/);
});

test("ルートの操作メニューで両方向通行にするとプロパティの方向が両通行になる", async ({
  page,
}) => {
  await routeFromEntrance(page).click({ button: "right", force: true });
  await page.getByRole("menuitem", { name: "両方向通行にする" }).click();

  await routeFromEntrance(page).click({ force: true });
  await expect(
    panel(page).getByRole("radio", { name: "両通行可 ⇌" }),
  ).toBeChecked();
});
