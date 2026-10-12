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
    await expect(
      panel(page).getByRole("button", { name: "選択したポイントをグループ化" }),
    ).toBeDisabled();
    await expect(
      panel(page).getByRole("button", { name: "選択した要素を削除" }),
    ).toBeEnabled();
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

test("Shiftを押したまま親グループをドラッグしても選択と親子の相対位置を維持する", async ({
  page,
}, testInfo) => {
  await selectGroup(page, "ph_floor1");
  await selectNode(page, "ph_booth", "Shift");
  await expect(node(page, "ph_floor1")).toHaveClass(/selected/);
  await expect(node(page, "ph_booth")).toHaveClass(/selected/);
  await expect(selectedNodes(page)).toHaveCount(2);

  // 親、選択済みの子、選択していない子を比較する。
  const ids = ["ph_floor1", "ph_booth", "ph_junction"];
  const before = await Promise.all(ids.map((id) => position(node(page, id))));
  const box = await node(page, "ph_floor1").boundingBox();
  if (!box) throw new Error("Missing group");

  await test.step("Shiftを押しながらグループ本体をドラッグする", async () => {
    await page.keyboard.down("Shift");
    try {
      await page.mouse.move(box.x + box.width - 30, box.y + 20);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width + 20, box.y + 50, { steps: 10 });
      await page.mouse.up();
    } finally {
      await page.keyboard.up("Shift");
    }
  });

  const after = await Promise.all(ids.map((id) => position(node(page, id))));
  const selectedIds = await selectedNodes(page).evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-id")),
  );
  await testInfo.attach("shift-drag-movement", {
    contentType: "application/json",
    body: JSON.stringify(
      {
        selectedIds,
        nodes: ids.map((id, index) => ({
          id,
          before: before[index],
          after: after[index],
          delta: {
            x: after[index].x - before[index].x,
            y: after[index].y - before[index].y,
          },
        })),
      },
      null,
      2,
    ),
  });

  // 選択の検証が失敗しても、位置ずれの検証まで実行して両方の結果を残す。
  await expect.soft(node(page, "ph_floor1")).toHaveClass(/selected/);
  await expect.soft(node(page, "ph_booth")).toHaveClass(/selected/);
  await expect.soft(selectedNodes(page)).toHaveCount(2);
  expectSameDelta(before, after);
});

test("Shift付きで未選択の親グループをドラッグしても選択済みの子が二重に移動しない", async ({
  page,
}) => {
  await selectNode(page, "ph_booth");
  const ids = ["ph_floor1", "ph_booth", "ph_junction"];
  const before = await Promise.all(ids.map((id) => position(node(page, id))));
  const box = await node(page, "ph_floor1").boundingBox();
  if (!box) throw new Error("Missing group");
  await page.keyboard.down("Shift");
  try {
    await page.mouse.move(box.x + box.width - 30, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 20, box.y + 50, { steps: 10 });
    await page.mouse.up();
  } finally {
    await page.keyboard.up("Shift");
  }
  await expect(selectedNodes(page)).toHaveCount(2);
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

test("Shift付きの未選択ノードのドラッグは既存の選択に追加して一括移動する", async ({
  page,
}) => {
  await selectNode(page, "ph_booth");
  const ids = ["ph_booth", "ph_gallery2f"];
  const before = await Promise.all(ids.map((id) => position(node(page, id))));
  await page.keyboard.down("Shift");
  try {
    await dragNode(page, "ph_gallery2f");
  } finally {
    await page.keyboard.up("Shift");
  }
  await expect(selectedNodes(page)).toHaveCount(2);
  for (const id of ids) await expect(node(page, id)).toHaveClass(/selected/);
  expectSameDelta(
    before,
    await Promise.all(ids.map((id) => position(node(page, id)))),
  );
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

const groupSelectedButton = (page: Page) =>
  panel(page).getByRole("button", {
    name: "選択したポイントをグループ化",
    exact: true,
  });
const deleteSelectedButton = (page: Page) =>
  panel(page).getByRole("button", { name: "選択した要素を削除", exact: true });

test("同じ親のポイントをグループ化すると位置と接続が保たれ、新しいグループだけが選択される", async ({
  page,
}) => {
  await selectNode(page, "ph_booth");
  await selectNode(page, "ph_wall", "Shift");
  await selectEdge(page, "Shift");
  const ids = ["ph_booth", "ph_wall", "ph_junction"];
  const before = await Promise.all(ids.map((id) => position(node(page, id))));
  const edgeCount = await page.locator(".react-flow__edge").count();
  await expect(groupSelectedButton(page)).toBeEnabled();
  await groupSelectedButton(page).click();
  await expect(selectedNodes(page)).toHaveCount(1);
  await expect(selectedEdges(page)).toHaveCount(0);
  await expect(
    panel(page).getByRole("textbox", { name: "ラベル（日本語）" }),
  ).toHaveValue("グループ 3");
  expect(await Promise.all(ids.map((id) => position(node(page, id))))).toEqual(
    before,
  );
  await expect(page.locator(".react-flow__edge")).toHaveCount(edgeCount);
  const createdId = await selectedNodes(page).getAttribute("data-id");
  if (!createdId) throw new Error("New group is not selected");
  const box = await node(page, createdId).boundingBox();
  if (!box) throw new Error("New group is not visible");
  await page.mouse.move(box.x + box.width - 30, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 20, box.y + 50, { steps: 10 });
  await page.mouse.up();
  const after = await Promise.all(ids.map((id) => position(node(page, id))));
  expectSameDelta(before.slice(0, 2), after.slice(0, 2));
  expect(after[2]).toEqual(before[2]);
});

test("所属違い・グループ・外部・ポイント不足でグループ化を無効にする", async ({
  page,
}) => {
  await selectNode(page, "ph_booth");
  await selectNode(page, "ph_gallery2f", "Shift");
  await expect(groupSelectedButton(page)).toBeDisabled();
  await expect(
    panel(page).getByText("同じ所属のポイントを選択してください。", {
      exact: true,
    }),
  ).toBeVisible();
  await selectNode(page, "ph_booth");
  await selectGroup(page, "ph_floor1", "Shift");
  await expect(groupSelectedButton(page)).toBeDisabled();
  await expect(
    panel(page).getByText("グループと外部ポイントはグループ化できません。", {
      exact: true,
    }),
  ).toBeVisible();
  await selectNode(page, "ph_booth");
  await selectNode(page, "external", "Shift");
  await expect(groupSelectedButton(page)).toBeDisabled();
  await expect(
    panel(page).getByText("グループと外部ポイントはグループ化できません。", {
      exact: true,
    }),
  ).toBeVisible();
  await selectNode(page, "ph_booth");
  await selectEdge(page, "Shift");
  await expect(groupSelectedButton(page)).toBeDisabled();
  await expect(
    panel(page).getByText("ポイントを2件以上選択してください。", {
      exact: true,
    }),
  ).toBeVisible();
});

test("混在選択を一括削除し、未選択のグループの中身を残す", async ({ page }) => {
  await selectNode(page, "ph_booth");
  await selectGroup(page, "ph_floor1", "Shift");
  await selectEdge(page, "Shift", "ph_e9");
  const before = await position(node(page, "ph_junction"));
  await expect(deleteSelectedButton(page)).toBeEnabled();
  await deleteSelectedButton(page).click();
  await expect(node(page, "ph_booth")).toHaveCount(0);
  await expect(node(page, "ph_floor1")).toHaveCount(0);
  await expect(edge(page, "ph_e9")).toHaveCount(0);
  await expect(edge(page, "ph_e2")).toHaveCount(0);
  await expect(edge(page, "ph_e4")).toHaveCount(0);
  await expect(edge(page, "ph_e3")).toBeVisible();
  await expect(node(page, "ph_junction")).toBeVisible();
  expect(await position(node(page, "ph_junction"))).toEqual(before);
  await expect(selectedNodes(page)).toHaveCount(0);
  await expect(selectedEdges(page)).toHaveCount(0);
});

test("外部ポイントを全選択して削除しても最後の1件とその接続を残す", async ({
  page,
}) => {
  await selectNode(page, "external");
  await selectNode(page, "external-ph_exit", "Shift");
  await selectEdge(page, "Shift", "ph_e_external_in");
  await deleteSelectedButton(page).click();
  await expect(node(page, "external")).toBeVisible();
  await expect(node(page, "external-ph_exit")).toHaveCount(0);
  await expect(edge(page, "ph_e_external_in")).toBeVisible();
  await expect(edge(page, "ph_e_external_out")).toHaveCount(0);
  await expect(selectedNodes(page)).toHaveCount(1);
  await expect(selectedEdges(page)).toHaveCount(1);
  await expect(deleteSelectedButton(page)).toBeDisabled();
});

test("英語の一括操作ボタンでポイントをグループ化できる", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", domain: "test.localhost", path: "/" },
  ]);
  await page.reload();
  await selectNode(page, "ph_booth");
  await selectNode(page, "ph_wall", "Shift");
  await expect(
    panel(page).getByRole("button", { name: "Delete selected elements" }),
  ).toBeEnabled();
  await panel(page)
    .getByRole("button", { name: "Group selected points" })
    .click();
  await expect(selectedNodes(page)).toHaveCount(1);
  await expect(
    panel(page).getByRole("textbox", { name: "Label (English)" }),
  ).toHaveValue("Group 3");
});
