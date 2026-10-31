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
    panel(page).getByText("Arrows: 0", { exact: true }),
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

test("計測済みグループ内でグループ化を繰り返しても子が祖先の枠からはみ出さない", async ({
  page,
}) => {
  const ids = ["ph_floor1"];
  const before = await Promise.all(
    ["ph_booth", "ph_wall"].map((id) => position(node(page, id))),
  );
  for (let i = 0; i < 3; i++) {
    await selectNode(page, "ph_booth");
    await selectNode(page, "ph_wall", "Shift");
    await groupSelectedButton(page).click();
    await expect(selectedNodes(page)).toHaveCount(1);
    const createdId = await selectedNodes(page).getAttribute("data-id");
    if (!createdId) throw new Error("Missing group");
    ids.push(createdId);
    await expect
      .poll(async () => {
        const boxes = await Promise.all(
          ids.map((id) => node(page, id).boundingBox()),
        );
        return boxes.slice(1).every((child, index) => {
          const parent = boxes[index];
          return (
            parent &&
            child &&
            child.x >= parent.x - 0.1 &&
            child.y >= parent.y - 0.1 &&
            child.x + child.width <= parent.x + parent.width + 0.1 &&
            child.y + child.height <= parent.y + parent.height + 0.1
          );
        });
      })
      .toBe(true);
    expect(
      await Promise.all(
        ["ph_booth", "ph_wall"].map((id) => position(node(page, id))),
      ),
    ).toEqual(before);
  }
});

test("単体選択から複数選択へ切り替えても削除ボタンをグループ化ボタンとして再利用しない", async ({
  page,
}) => {
  await selectNode(page, "ph_booth");
  const original = await panel(page)
    .getByRole("button", { name: "このポイントを削除", exact: true })
    .elementHandle();
  if (!original) throw new Error("Missing delete button");
  await selectNode(page, "ph_wall", "Shift");
  await expect(groupSelectedButton(page)).toBeVisible();
  await expect(deleteSelectedButton(page)).toBeVisible();
  expect(
    await original.evaluate(
      (element) =>
        element.isConnected &&
        element.textContent?.trim() === "選択した要素を削除",
    ),
  ).toBe(true);
  await selectNode(page, "ph_wall", "Shift");
  await expect(
    panel(page).getByRole("button", {
      name: "このポイントを削除",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await original.evaluate(
      (element) =>
        element.isConnected &&
        element.textContent?.trim() === "このポイントを削除",
    ),
  ).toBe(true);
});

const pointsProperties = (page: Page, count = 2) =>
  panel(page).getByRole("region", {
    name: `ポイント（${count}件）`,
    exact: true,
  });
const edgesProperties = (page: Page, count = 2) =>
  panel(page).getByRole("region", { name: `矢印（${count}件）`, exact: true });

test("ポイントと矢印の編集欄を上下に表示し、混在値を一括上書きできる", async ({
  page,
}) => {
  await selectNode(page, "ph_booth");
  await selectNode(page, "ph_junction", "Shift");
  await selectEdge(page, "Shift", "ph_e1");
  await selectEdge(page, "Shift", "ph_e2");
  const points = pointsProperties(page);
  const edges = edgesProperties(page);
  await expect(points).toBeVisible();
  await expect(edges).toBeVisible();
  const pBox = await points.boundingBox();
  const eBox = await edges.boundingBox();
  if (!pBox || !eBox) throw new Error("Missing property sections");
  expect(pBox.y + pBox.height).toBeLessThanOrEqual(eBox.y);
  const dwell = points.getByRole("checkbox", { name: /^停滞を許容する/ });
  await expect(dwell).toBeChecked({ indeterminate: true });
  expect(await dwell.ariaSnapshot()).toContain("[checked=mixed]");
  await dwell.focus();
  await dwell.press("Space");
  await expect(dwell).toBeChecked();
  await dwell.press("Space");
  await expect(dwell).not.toBeChecked();
  await expect(
    points.getByRole("checkbox", { name: /^目的地として扱う/ }),
  ).toBeDisabled();
  await expect(edges.getByRole("radio", { name: /^両通行可/ })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(edges.getByRole("radio", { name: /^片方向/ })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await edges.getByRole("radio", { name: /^両通行可/ }).click();
  await expect(edges.getByRole("radio", { name: /^両通行可/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(
    edges.getByRole("button", { name: /^向きを反転/ }),
  ).toBeDisabled();
  await expect(selectedNodes(page)).toHaveCount(2);
  await expect(selectedEdges(page)).toHaveCount(2);
  await selectNode(page, "ph_booth");
  await expect(
    panel(page).getByRole("checkbox", { name: /^停滞を許容する/ }),
  ).not.toBeChecked();
  await expect(
    panel(page).getByRole("textbox", { name: "ラベル（日本語）" }),
  ).toHaveValue("ブースA");
  await selectNode(page, "ph_wall");
  await expect(
    panel(page).getByRole("checkbox", { name: /^停滞を許容する/ }),
  ).toBeChecked();
});

test("混在が残る一部適用後も次の操作で解除でき、選択変更で操作意図と結果がリセットされる", async ({
  page,
}) => {
  await selectNode(page, "ph_booth");
  await selectNode(page, "ph_wall", "Shift");
  await selectNode(page, "ph_junction", "Shift");
  const destination = pointsProperties(page, 3).getByRole("checkbox", {
    name: /^目的地として扱う/,
  });
  await expect(destination).toBeChecked({ indeterminate: true });
  await pointsProperties(page, 3)
    .getByText("目的地として扱う", { exact: true })
    .click();
  await expect(destination).toBeChecked({ indeterminate: true });
  await expect(panel(page).getByRole("status")).toContainText(
    "1件を変更しました。1件は変更できませんでした。",
  );
  await expect(panel(page).getByRole("status")).toContainText(
    "停滞を許容しないポイントは、目的地として扱えません。（1件）",
  );
  await pointsProperties(page, 3)
    .getByText("目的地として扱う", { exact: true })
    .click();
  await expect(destination).not.toBeChecked();
  await expect(panel(page).getByRole("status")).toContainText(
    "2件を変更しました。0件は変更できませんでした。",
  );
  await selectNode(page, "ph_booth");
  await expect(
    panel(page).getByRole("textbox", { name: "ラベル（日本語）" }),
  ).toHaveValue("ブースA");
  await selectNode(page, "ph_wall", "Shift");
  await expect(panel(page).getByRole("status")).toBeEmpty();
  await pointsProperties(page)
    .getByText("目的地として扱う", { exact: true })
    .click();
  await expect(
    pointsProperties(page).getByRole("checkbox", { name: /^目的地として扱う/ }),
  ).toBeChecked();
});

test("片方向の矢印だけ反転し、両通行の除外件数と理由を通知する", async ({
  page,
}) => {
  await selectEdge(page, undefined, "ph_e1");
  await selectEdge(page, "Shift", "ph_e2");
  await edgesProperties(page)
    .getByRole("button", { name: /^向きを反転/ })
    .click();
  await expect(edge(page, "ph_e1")).toHaveAttribute(
    "aria-label",
    "Edge from ph_junction to ph_entrance",
  );
  await expect(edge(page, "ph_e2")).toHaveAttribute(
    "aria-label",
    "Edge from ph_junction to ph_booth",
  );
  await expect(panel(page).getByRole("status")).toContainText(
    "1件を変更しました。1件は変更できませんでした。",
  );
  await expect(panel(page).getByRole("status")).toContainText(
    "両通行の矢印は反転の対象外です。（1件）",
  );
  await expect(selectedEdges(page)).toHaveCount(2);
});

test("グループと外部ポイントを編集対象から除き、通常ポイントだけ上書きする", async ({
  page,
}) => {
  await selectNode(page, "ph_booth");
  await selectGroup(page, "ph_floor1", "Shift");
  await selectNode(page, "external", "Shift");
  await expect(pointsProperties(page, 1)).toBeVisible();
  await pointsProperties(page, 1)
    .getByText("停滞を許容する", { exact: true })
    .click();
  await expect(panel(page).getByRole("status")).toContainText(
    "1件を変更しました。0件は変更できませんでした。",
  );
  await selectGroup(page, "ph_floor1");
  await expect(
    panel(page).getByRole("textbox", { name: "ラベル（日本語）" }),
  ).toHaveValue("1F");
  await selectNode(page, "external");
  await expect(panel(page).getByRole("checkbox")).toHaveCount(0);
});

test("英語でも混在値と編集結果を表示する", async ({ page, context }) => {
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", domain: "test.localhost", path: "/" },
  ]);
  await page.reload();
  await selectNode(page, "ph_booth");
  await selectNode(page, "ph_junction", "Shift");
  const points = panel(page).getByRole("region", {
    name: "Points (2)",
    exact: true,
  });
  await expect(points.getByText("Values are mixed")).toHaveCount(2);
  const dwell = points.getByRole("checkbox").first();
  await expect(dwell).toBeChecked({ indeterminate: true });
  await points.getByText("Allow dwelling", { exact: true }).click();
  await expect(panel(page).getByRole("status")).toContainText(
    "Changed 1 element. Could not change 0 elements.",
  );
});

const panelLink = (page: Page, name: string) =>
  panel(page).getByRole("button", { name, exact: true });
const labelField = (page: Page) =>
  panel(page).getByRole("textbox", { name: "ラベル（日本語）" });

test("ルートのパネルで始点を押すと、そのポイントがキャンバスとパネルで選択される", async ({
  page,
}) => {
  await selectEdge(page);
  await expect(panel(page).locator(":focus")).toHaveCount(0);
  await panelLink(page, "エントランスホール").click();
  await expect(selectedEdges(page)).toHaveCount(0);
  await expect(selectedNodes(page)).toHaveCount(1);
  await expect(node(page, "ph_junction")).toHaveClass(/selected/);
  await expect(labelField(page)).toHaveValue("エントランスホール");
});

test("ポイントのパネルに接続しているルートと所属グループを表示し、ルートを押すとそのルートを選択する", async ({
  page,
}) => {
  await selectNode(page, "ph_booth");
  const routes = panel(page).getByRole("list", { name: "接続しているルート" });
  await expect(routes.getByRole("button")).toHaveText([
    "エントランスホール ⇌ ブースA",
    "ブースA → 出口",
  ]);
  await expect(
    panel(page).getByRole("list", { name: "所属グループ" }).getByRole("button"),
  ).toHaveText(["1F"]);
  await routes.getByRole("button", { name: "ブースA → 出口" }).click();
  await expect(selectedNodes(page)).toHaveCount(0);
  await expect(selectedEdges(page)).toHaveCount(1);
  await expect(edge(page, "ph_e4")).toHaveClass(/selected/);
  await expect(panelLink(page, "ブースA")).toBeVisible();
  await expect(panelLink(page, "出口")).toBeVisible();
});

test("グループのパネルで含まれる要素を押すとその要素を選択し、所属グループのリンクで戻れる", async ({
  page,
}) => {
  await selectGroup(page, "ph_floor1");
  await expect(
    panel(page).getByRole("list", { name: "含まれる要素" }).getByRole("button"),
  ).toHaveText([
    "1F 階段",
    "1F エレベーター",
    "入口",
    "エントランスホール",
    "ブースA",
    "壁展示",
    "出口",
  ]);
  await expect(
    panel(page).getByRole("list", { name: "所属グループ" }),
  ).toHaveCount(0);
  await panelLink(page, "ブースA").click();
  await expect(selectedNodes(page)).toHaveCount(1);
  await expect(node(page, "ph_booth")).toHaveClass(/selected/);
  await expect(labelField(page)).toHaveValue("ブースA");
  await panelLink(page, "1F").click();
  await expect(selectedNodes(page)).toHaveCount(1);
  await expect(node(page, "ph_floor1")).toHaveClass(/selected/);
  await expect(labelField(page)).toHaveValue("1F");
});

test("キーボードでリンクを選ぶと、フォーカスがパネル内の新しい要素の見出しへ移る", async ({
  page,
}) => {
  await selectEdge(page);
  await panelLink(page, "エントランスホール").focus();
  await page.keyboard.press("Tab");
  await expect(panelLink(page, "ブースA")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(node(page, "ph_booth")).toHaveClass(/selected/);
  const focused = panel(page).locator(":focus");
  await expect(focused).toHaveCount(1);
  await expect(focused).toContainText("ph_booth");
  await page.keyboard.press("Tab");
  await expect(labelField(page)).toBeFocused();
});

const outline = (page: Page) =>
  panel(page).getByRole("treegrid", { name: "要素" });
const outlineRow = (page: Page, name: string) =>
  outline(page).getByRole("row", { name, exact: true });
const outlineRows = (page: Page) =>
  outline(page)
    .getByRole("row")
    .evaluateAll((rows) =>
      rows.map((row) => {
        const level = Number(row.getAttribute("aria-level") ?? 1);
        return `${"  ".repeat(level - 1)}${row.textContent}`;
      }),
    );
const clearSelection = (page: Page) =>
  page.locator(".react-flow__pane").click({ position: { x: 10, y: 10 } });

test("何も選択していないとき、サイドパネルはグループの中にポイントを入れ子にした木と、ルートの一覧を表示する", async ({
  page,
}) => {
  await expect
    .poll(() => outlineRows(page))
    .toEqual([
      "2F",
      "  2F 階段",
      "  2F ホール",
      "  2F エレベーター",
      "  展示室B",
      "1F",
      "  1F 階段",
      "  1F エレベーター",
      "  入口",
      "  エントランスホール",
      "  ブースA",
      "  壁展示",
      "  出口",
      "外部",
      "外部",
      "ルート",
      "入口 → エントランスホール",
      "エントランスホール ⇌ ブースA",
      "エントランスホール ⇌ 壁展示",
      "ブースA → 出口",
      "壁展示 → 出口",
      "エントランスホール ⇌ 1F 階段",
      "エントランスホール ⇌ 1F エレベーター",
      "1F 階段 ⇌ 2F 階段",
      "1F エレベーター ⇌ 2F エレベーター",
      "2F 階段 ⇌ 2F ホール",
      "2F エレベーター ⇌ 2F ホール",
      "2F ホール ⇌ 展示室B",
      "外部 → 入口",
      "出口 → 外部",
    ]);
  await expect(outline(page).getByRole("rowheader")).toHaveText(["ルート"]);
  await expect(outlineRow(page, "2F")).toHaveAttribute("aria-expanded", "true");
  await expect(outlineRow(page, "1F")).toHaveAttribute("aria-expanded", "true");
});

test("グループの開閉ボタンで中の要素を隠して戻せ、そのグループは選択されない", async ({
  page,
}) => {
  await outlineRow(page, "1F")
    .getByRole("button", { name: "折りたたむ" })
    .click();
  await expect(outlineRow(page, "1F")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(outlineRow(page, "ブースA")).toHaveCount(0);
  await expect(outlineRow(page, "2F 階段")).toBeVisible();
  await expect(selectedNodes(page)).toHaveCount(0);
  await expect(outline(page)).toBeVisible();

  await outlineRow(page, "1F").getByRole("button", { name: "展開" }).click();
  await expect(outlineRow(page, "1F")).toHaveAttribute("aria-expanded", "true");
  await expect(outlineRow(page, "ブースA")).toBeVisible();
  await expect(selectedNodes(page)).toHaveCount(0);
});

test("木の行は、ラベルが長く折り返しても隣の行と重ならない", async ({
  page,
}) => {
  const longLabel = "国際会議場メインエントランス東側ブースA（特別展示エリア）";
  await selectNode(page, "ph_booth");
  await panel(page)
    .getByRole("textbox", { name: "ラベル（日本語）" })
    .fill(longLabel);
  await panel(page).getByRole("button", { name: "一覧に戻る" }).click();

  await expect(outlineRow(page, longLabel)).toBeVisible();
  const boxes = await outline(page)
    .getByRole("row")
    .evaluateAll((rows) =>
      rows.map((row) => {
        const { top, bottom } = row.getBoundingClientRect();
        return { top, bottom };
      }),
    );
  for (const [above, below] of boxes
    .slice(0, -1)
    .map((box, i) => [box, boxes[i + 1]]))
    expect(above.bottom).toBeLessThanOrEqual(below.top);
});

test("木からグループ内のポイント・グループ・ルートを選ぶと、キャンバスでその要素だけが選択されプロパティを表示する", async ({
  page,
}) => {
  await expect(outlineRow(page, "ブースA")).toHaveAttribute("aria-level", "2");
  await outlineRow(page, "ブースA").click();
  await expect(selectedNodes(page)).toHaveCount(1);
  await expect(node(page, "ph_booth")).toHaveClass(/selected/);
  await expect(labelField(page)).toHaveValue("ブースA");
  await expect(outline(page)).toHaveCount(0);

  await clearSelection(page);
  await expect(outline(page)).toBeVisible();
  await expect(panel(page).locator(":focus")).toHaveCount(0);
  await outlineRow(page, "1F").click();
  await expect(selectedNodes(page)).toHaveCount(1);
  await expect(node(page, "ph_floor1")).toHaveClass(/selected/);
  await expect(labelField(page)).toHaveValue("1F");

  await clearSelection(page);
  await outlineRow(page, "ブースA → 出口").click();
  await expect(selectedNodes(page)).toHaveCount(0);
  await expect(selectedEdges(page)).toHaveCount(1);
  await expect(edge(page, "ph_e4")).toHaveClass(/selected/);
  await expect(panel(page).getByRole("code")).toHaveText("ph_e4");
});

test("木を矢印キーで移動し、左右キーでグループを畳んで開き、Enter で選ぶとフォーカスが選んだ要素の見出しへ移る", async ({
  page,
}) => {
  await outlineRow(page, "2F").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(outlineRow(page, "2F")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(outlineRow(page, "2F 階段")).toHaveCount(0);
  await page.keyboard.press("ArrowDown");
  await expect(outlineRow(page, "1F")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(outlineRow(page, "ブースA")).toHaveCount(0);
  await expect(selectedNodes(page)).toHaveCount(0);

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(outlineRow(page, "入口 → エントランスホール")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(outlineRow(page, "1F")).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await expect(outlineRow(page, "1F")).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ArrowDown");
  await expect(outlineRow(page, "1F 階段")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(selectedNodes(page)).toHaveCount(1);
  await expect(node(page, "ph_stairs1f")).toHaveClass(/selected/);
  const focused = panel(page).locator(":focus");
  await expect(focused).toHaveCount(1);
  await expect(focused).toContainText("ph_stairs1f");
});

const backToOutline = (page: Page) =>
  panel(page).getByRole("button", { name: "一覧に戻る" });

test("「一覧に戻る」を押すと選択が解除され、サイドパネルが一覧に戻る", async ({
  page,
}) => {
  await expect(backToOutline(page)).toHaveCount(0);
  await selectNode(page, "ph_booth");
  await backToOutline(page).click();
  await expect(selectedNodes(page)).toHaveCount(0);
  await expect(outline(page)).toBeVisible();
  await expect(backToOutline(page)).toHaveCount(0);

  await selectNode(page, "ph_booth");
  await clearSelection(page);
  await expect(outline(page)).toBeVisible();
  await expect(panel(page).locator(":focus")).toHaveCount(0);

  await selectNode(page, "ph_booth");
  await selectEdge(page, "Shift");
  await backToOutline(page).click();
  await expect(selectedNodes(page)).toHaveCount(0);
  await expect(selectedEdges(page)).toHaveCount(0);
  await expect(outline(page)).toBeVisible();
});

test("キーボードだけで木から要素を選び、「一覧に戻る」で木の先頭の行へフォーカスが戻る", async ({
  page,
}) => {
  await outlineRow(page, "ブースA").focus();
  await page.keyboard.press("Enter");
  await expect(node(page, "ph_booth")).toHaveClass(/selected/);
  await expect(panel(page).locator(":focus")).toContainText("ph_booth");

  await backToOutline(page).focus();
  await page.keyboard.press("Enter");
  await expect(selectedNodes(page)).toHaveCount(0);
  await expect(outlineRow(page, "2F")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(selectedNodes(page)).toHaveCount(1);
  await expect(node(page, "ph_floor2")).toHaveClass(/selected/);
  await expect(panel(page).locator(":focus")).toContainText("ph_floor2");

  await backToOutline(page).focus();
  await page.keyboard.press("Enter");
  await expect(outlineRow(page, "2F")).toBeFocused();
  await expect(outlineRow(page, "2F")).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ArrowDown");
  await expect(outlineRow(page, "2F 階段")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(node(page, "ph_stairs2f")).toHaveClass(/selected/);
  await expect(panel(page).locator(":focus")).toContainText("ph_stairs2f");
});
