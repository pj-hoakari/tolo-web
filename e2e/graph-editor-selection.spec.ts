import { expect, type Locator, type Page, test } from "@playwright/test";

test.use({ viewport: { width: 1600, height: 1000 } });
const node = (page: Page, id: string) => page.getByTestId(`rf__node-${id}`);
const edge = (page: Page, id = "ph_e2") => page.getByTestId(`rf__edge-${id}`);
const panel = (page: Page) => page.getByRole("complementary");
const selectedNodes = (page: Page) =>
  page.locator(".react-flow__node.selected");
const selectedEdges = (page: Page) =>
  page.locator(".react-flow__edge.selected");
const position = (element: Locator) =>
  element.evaluate((el: HTMLElement) => {
    const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(
      el.style.transform,
    );
    if (!match) throw new Error(`Unexpected transform: ${el.style.transform}`);
    return { x: Number(match[1]), y: Number(match[2]) };
  });
const selectNode = (page: Page, id: string, modifier?: "Shift" | "Control") =>
  node(page, id).click({
    position: { x: 8, y: 8 },
    modifiers: modifier ? [modifier] : [],
  });
const selectGroup = async (
  page: Page,
  id: string,
  modifier?: "Shift" | "Control",
) => {
  const box = await node(page, id).boundingBox();
  if (!box) throw new Error(`${id} is not visible`);
  await node(page, id).click({
    position: { x: box.width - 30, y: box.height - 30 },
    modifiers: modifier ? [modifier] : [],
  });
};
const edgePoint = (page: Page, id = "ph_e2") =>
  edge(page, id)
    .locator(".react-flow__edge-interaction")
    .evaluate((el: SVGPathElement) => {
      const point = el.getPointAtLength(el.getTotalLength() / 2);
      const matrix = el.getScreenCTM();
      if (!matrix) throw new Error("Missing edge transform");
      const screen = point.matrixTransform(matrix);
      return { x: screen.x, y: screen.y };
    });
const selectEdge = async (
  page: Page,
  modifier?: "Shift" | "Control",
  id = "ph_e2",
) => {
  const point = await edgePoint(page, id);
  if (modifier) await page.keyboard.down(modifier);
  await page.mouse.click(point.x, point.y);
  if (modifier) await page.keyboard.up(modifier);
};
const dragNode = async (page: Page, id: string) => {
  const box = await node(page, id).boundingBox();
  if (!box) throw new Error(`${id} is not visible`);
  await page.mouse.move(box.x + 8, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + 58, box.y + 38, { steps: 10 });
  await page.mouse.up();
};
const expectSameDelta = (
  before: { x: number; y: number }[],
  after: { x: number; y: number }[],
) => {
  const dx = after[0].x - before[0].x;
  const dy = after[0].y - before[0].y;
  expect(dx).toBeGreaterThan(0);
  expect(dy).toBeGreaterThan(0);
  for (let i = 1; i < before.length; i++) {
    expect(after[i].x - before[i].x).toBeCloseTo(dx, 3);
    expect(after[i].y - before[i].y).toBeCloseTo(dy, 3);
  }
};

test.beforeEach(async ({ page }) => {
  await page.goto("/event/test/management/graph/edit");
  await expect(node(page, "ph_booth")).toBeVisible();
});

for (const modifier of ["Shift", "Control"] as const) {
  test(`${modifier}で混在選択・解除し、単クリックで単体選択に戻る`, async ({
    page,
  }) => {
    await selectNode(page, "ph_booth");
    await selectGroup(page, "ph_floor2", modifier);
    await selectEdge(page, modifier);
    await expect(selectedNodes(page)).toHaveCount(2);
    await expect(selectedEdges(page)).toHaveCount(1);
    await expect(
      panel(page).getByText("ノード: 1件", { exact: true }),
    ).toBeVisible();
    await expect(
      panel(page).getByText("矢印: 1件", { exact: true }),
    ).toBeVisible();
    await expect(
      panel(page).getByText("グループ: 1件", { exact: true }),
    ).toBeVisible();
    await expect(panel(page).getByRole("textbox")).toHaveCount(0);
    await expect(panel(page).getByRole("button")).toHaveCount(0);
    await selectEdge(page, modifier);
    await expect(selectedEdges(page)).toHaveCount(0);
    await selectGroup(page, "ph_floor2", modifier);
    await expect(
      panel(page).getByRole("textbox", { name: "ラベル（日本語）" }),
    ).toHaveValue("ブースA");
    await selectNode(page, "ph_gallery2f", modifier);
    await selectNode(page, "ph_booth");
    await expect(selectedNodes(page)).toHaveCount(1);
    await expect(node(page, "ph_booth")).toHaveClass(/selected/);
    await page
      .locator(".react-flow__pane")
      .click({ position: { x: 10, y: 10 } });
    await expect(selectedNodes(page)).toHaveCount(0);
  });
}

test("修飾キーを離して異なるグループのノードを一括移動し矢印を追従させる", async ({
  page,
}) => {
  await selectNode(page, "ph_booth");
  await selectNode(page, "ph_gallery2f", "Shift");
  await selectEdge(page, "Control");
  const before = await Promise.all([
    position(node(page, "ph_booth")),
    position(node(page, "ph_gallery2f")),
  ]);
  const pathBefore = await edge(page)
    .locator(".react-flow__edge-path")
    .getAttribute("d");
  await dragNode(page, "ph_booth");
  await expect(selectedNodes(page)).toHaveCount(2);
  await expect(selectedEdges(page)).toHaveCount(1);
  const after = await Promise.all([
    position(node(page, "ph_booth")),
    position(node(page, "ph_gallery2f")),
  ]);
  expectSameDelta(before, after);
  await expect(
    edge(page).locator(".react-flow__edge-path"),
  ).not.toHaveAttribute("d", pathBefore ?? "");
});

test("親グループと子の同時選択では子が二重に移動しない", async ({ page }) => {
  await selectGroup(page, "ph_floor1");
  await selectNode(page, "ph_booth", "Shift");
  await selectGroup(page, "ph_floor2", "Control");
  const ids = [
    "ph_floor1",
    "ph_booth",
    "ph_junction",
    "ph_floor2",
    "ph_gallery2f",
  ];
  const before = await Promise.all(ids.map((id) => position(node(page, id))));
  const box = await node(page, "ph_floor1").boundingBox();
  if (!box) throw new Error("Missing group");
  await page.mouse.move(box.x + box.width - 30, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 20, box.y + 50, { steps: 10 });
  await page.mouse.up();
  await expect(selectedNodes(page)).toHaveCount(3);
  expectSameDelta(
    before,
    await Promise.all(ids.map((id) => position(node(page, id)))),
  );
});

test("未選択ノードをキーなしでドラッグすると単体選択になる", async ({
  page,
}) => {
  await selectNode(page, "ph_booth");
  await selectNode(page, "ph_gallery2f", "Shift");
  const before = await position(node(page, "ph_booth"));
  await dragNode(page, "ph_junction");
  await expect(selectedNodes(page)).toHaveCount(1);
  await expect(node(page, "ph_junction")).toHaveClass(/selected/);
  expect(await position(node(page, "ph_booth"))).toEqual(before);
});

test("矢印のみ複数選択してドラッグしてもノードを移動しない", async ({
  page,
}) => {
  await selectEdge(page);
  await selectEdge(page, "Shift", "ph_e3");
  await expect(selectedEdges(page)).toHaveCount(2);
  await expect(selectedNodes(page)).toHaveCount(0);
  const ids = ["ph_booth", "ph_junction", "ph_wall"];
  const before = await Promise.all(ids.map((id) => position(node(page, id))));
  const point = await edgePoint(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 50, point.y + 30, { steps: 10 });
  await page.mouse.up();
  expect(await Promise.all(ids.map((id) => position(node(page, id))))).toEqual(
    before,
  );
});

test("英語でも複数選択件数を表示する", async ({ page, context }) => {
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", domain: "test.localhost", path: "/" },
  ]);
  await page.reload();
  await selectNode(page, "ph_booth");
  await selectNode(page, "ph_gallery2f", "Shift");
  await expect(
    panel(page).getByText("Nodes: 2", { exact: true }),
  ).toBeVisible();
  await expect(
    panel(page).getByText("Edges: 0", { exact: true }),
  ).toBeVisible();
  await expect(
    panel(page).getByText("Groups: 0", { exact: true }),
  ).toBeVisible();
});
