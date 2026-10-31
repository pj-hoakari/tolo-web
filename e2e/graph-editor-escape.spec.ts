import { expect, type Page, test } from "@playwright/test";

test.use({ viewport: { width: 1600, height: 1000 } });

const node = (page: Page, id: string) => page.getByTestId(`rf__node-${id}`);
const edge = (page: Page, id: string) => page.getByTestId(`rf__edge-${id}`);
const panel = (page: Page) => page.getByRole("complementary");
const selectedNodes = (page: Page) =>
  page.locator(".react-flow__node.selected");
const selectedEdges = (page: Page) =>
  page.locator(".react-flow__edge.selected");
const outline = (page: Page) =>
  panel(page).getByRole("treegrid", { name: "要素" });
const outlineRow = (page: Page, name: string) =>
  outline(page).getByRole("row", { name, exact: true });
const labelField = (page: Page) =>
  panel(page).getByRole("textbox", { name: "ラベル（日本語）" });
const easyConnectPanel = (page: Page) =>
  page.getByText("ルートを追加: ポイントから別のポイントへドラッグ");
const fromNodePanel = (page: Page) =>
  page.getByText("ルートを追加: 接続先のポイントをクリック");

const selectNode = (page: Page, id: string) =>
  node(page, id).click({ position: { x: 8, y: 8 } });
const selectEdge = async (page: Page, id: string, modifier?: "Shift") => {
  const point = await edge(page, id)
    .locator(".react-flow__edge-interaction")
    .evaluate((el: SVGPathElement) => {
      const middle = el.getPointAtLength(el.getTotalLength() / 2);
      const matrix = el.getScreenCTM();
      if (!matrix) throw new Error("Missing edge transform");
      const screen = middle.matrixTransform(matrix);
      return { x: screen.x, y: screen.y };
    });
  if (modifier) await page.keyboard.down(modifier);
  await page.mouse.click(point.x, point.y);
  if (modifier) await page.keyboard.up(modifier);
};
const startEdgeCreation = async (page: Page) => {
  await page
    .locator(".react-flow__pane")
    .click({ button: "right", position: { x: 20, y: 20 } });
  await page
    .getByRole("menu", { name: "キャンバスの操作" })
    .getByRole("menuitem", { name: "ルートを追加", exact: true })
    .click();
  await expect(easyConnectPanel(page)).toBeVisible();
};
const expectClearedToOutline = async (page: Page) => {
  await expect(selectedNodes(page)).toHaveCount(0);
  await expect(selectedEdges(page)).toHaveCount(0);
  await expect(outlineRow(page, "2F")).toBeFocused();
};

test.beforeEach(async ({ page }) => {
  await page.goto("/event/test/management/graph/edit");
  await expect(node(page, "ph_booth")).toBeVisible();
});

test("ポイントを選んで Esc を押すと選択が解除され、木の先頭の行へフォーカスが移る", async ({
  page,
}) => {
  await selectNode(page, "ph_booth");
  await expect(labelField(page)).toHaveValue("ブースA");

  await page.keyboard.press("Escape");

  await expectClearedToOutline(page);
  await page.keyboard.press("ArrowDown");
  await expect(outlineRow(page, "2F 階段")).toBeFocused();
});

test("ルートを選んで Esc を押すと選択が解除され、木の先頭の行へフォーカスが移る", async ({
  page,
}) => {
  await selectEdge(page, "ph_e2");
  await expect(edge(page, "ph_e2")).toHaveClass(/selected/);

  await page.keyboard.press("Escape");

  await expectClearedToOutline(page);
});

test("ポイントとルートを混在して選んで Esc を押すと、すべての選択が解除される", async ({
  page,
}) => {
  await selectNode(page, "ph_booth");
  await selectEdge(page, "ph_e2", "Shift");
  await expect(selectedNodes(page)).toHaveCount(1);
  await expect(selectedEdges(page)).toHaveCount(1);

  await page.keyboard.press("Escape");

  await expectClearedToOutline(page);
});

test("サイドパネルにフォーカスがあるときも、Esc で選択が解除され木へ戻る", async ({
  page,
}) => {
  await outlineRow(page, "ブースA").press("Enter");
  await expect(panel(page).locator(":focus")).toContainText("ph_booth");

  await page.keyboard.press("Escape");

  await expectClearedToOutline(page);
});

test("プロパティの入力欄で Esc を押しても、選択は解除されない", async ({
  page,
}) => {
  await selectNode(page, "ph_booth");
  await labelField(page).fill("ブースZ");

  await page.keyboard.press("Escape");

  await expect(labelField(page)).toBeFocused();
  await expect(labelField(page)).toHaveValue("ブースZ");
  await expect(node(page, "ph_booth")).toHaveClass(/selected/);
});

test("プロパティの選択肢を開いて Esc を押すと、選択肢だけが閉じ選択は残る", async ({
  page,
}) => {
  await selectNode(page, "ph_booth");
  await panel(page)
    .getByRole("button", { name: /接続先/ })
    .click();
  await expect(page.getByRole("listbox")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(node(page, "ph_booth")).toHaveClass(/selected/);
  await expect(outline(page)).toHaveCount(0);
});

test("ラベルをその場で編集中に Esc を押すと、編集だけが取り消され選択は残る", async ({
  page,
}) => {
  await selectNode(page, "ph_booth");
  await page.getByRole("button", { name: "「ブースA」のラベルを編集" }).click();
  await node(page, "ph_booth")
    .getByRole("textbox", { name: "ポイントのラベル（日本語）" })
    .fill("ブースZ");

  await page.keyboard.press("Escape");

  await expect(
    page.getByRole("button", { name: "「ブースA」のラベルを編集" }),
  ).toBeEnabled();
  await expect(node(page, "ph_booth")).toHaveClass(/selected/);
  await expect(labelField(page)).toHaveValue("ブースA");
});

test("ルートを追加モード中に Esc を押すと、モードだけが終わり選択は残る", async ({
  page,
}) => {
  await startEdgeCreation(page);
  await outlineRow(page, "ブースA").press("Enter");
  await expect(node(page, "ph_booth")).toHaveClass(/selected/);
  await expect(panel(page).locator(":focus")).toContainText("ph_booth");

  await page.keyboard.press("Escape");

  await expect(easyConnectPanel(page)).toBeHidden();
  await expect(node(page, "ph_booth")).toHaveClass(/selected/);
  await expect(outline(page)).toHaveCount(0);
});

test("このポイントからルートを追加している間に Esc を押すと、モードだけが終わり選択は残る", async ({
  page,
}) => {
  await node(page, "ph_booth").click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "このポイントからルートを追加" })
    .click();
  await expect(fromNodePanel(page)).toBeVisible();
  await expect(node(page, "ph_booth")).toHaveClass(/selected/);

  await page.keyboard.press("Escape");

  await expect(fromNodePanel(page)).toBeHidden();
  await expect(node(page, "ph_booth")).toHaveClass(/selected/);
  await expect(outline(page)).toHaveCount(0);
});

test("ルートを追加モード中にキャンバスのポイントを選んで Esc を押しても、モードだけが終わり選択は残る", async ({
  page,
}) => {
  await startEdgeCreation(page);
  await selectNode(page, "ph_booth");
  await expect(node(page, "ph_booth")).toHaveClass(/selected/);
  await expect(node(page, "ph_booth")).toBeFocused();

  await page.keyboard.press("Escape");

  await expect(easyConnectPanel(page)).toBeHidden();
  await expect(node(page, "ph_booth")).toHaveClass(/selected/);
});

test("ポイントのメニューを開いて Esc を押すと、メニューだけが閉じ選択は残る", async ({
  page,
}) => {
  await node(page, "ph_booth").click({ button: "right" });
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(menu).toHaveCount(0);
  await expect(node(page, "ph_booth")).toHaveClass(/selected/);
  await expect(outline(page)).toHaveCount(0);
});
