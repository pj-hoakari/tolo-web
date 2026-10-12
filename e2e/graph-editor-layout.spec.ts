import { expect, type Locator, type Page, test } from "@playwright/test";

test.use({ viewport: { width: 1600, height: 1000 } });

type Box = { x: number; y: number; width: number; height: number };

const node = (page: Page, id: string) => page.getByTestId(`rf__node-${id}`);
const allNodes = (page: Page) => page.locator(".react-flow__node");
const allEdges = (page: Page) => page.locator(".react-flow__edge");
const panel = (page: Page) => page.getByRole("complementary");
const easyConnectPanel = (page: Page) =>
  page.getByText("ルートを追加: ポイントから別のポイントへドラッグ");
const fromNodePanel = (page: Page) =>
  page.getByText("ルートを追加: 終点にするポイントをクリック");

const floor1Points = [
  "ph_stairs1f",
  "ph_elevator1f",
  "ph_entrance",
  "ph_junction",
  "ph_booth",
  "ph_wall",
  "ph_exit",
];
const floor2Points = [
  "ph_stairs2f",
  "ph_hall2f",
  "ph_elevator2f",
  "ph_gallery2f",
];
const points = [
  ...floor1Points,
  ...floor2Points,
  "external",
  "external-ph_exit",
];

const flowBox = (l: Locator): Promise<Box> =>
  l.evaluate((el: HTMLElement) => {
    const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(
      el.style.transform,
    );
    if (!m) throw new Error(`unexpected transform: ${el.style.transform}`);
    return {
      x: Number(m[1]),
      y: Number(m[2]),
      width: el.offsetWidth,
      height: el.offsetHeight,
    };
  });
const zoom = (page: Page) =>
  page.locator(".react-flow__viewport").evaluate((el: HTMLElement) => {
    const m = /scale\(([\d.]+)\)/.exec(el.style.transform);
    if (!m) throw new Error(`unexpected transform: ${el.style.transform}`);
    return Number(m[1]);
  });
const flowBoxes = async (page: Page, ids: string[]) =>
  Object.fromEntries(
    await Promise.all(
      ids.map(async (id) => [id, await flowBox(node(page, id))] as const),
    ),
  );

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;
const contains = (outer: Box, inner: Box) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;
const screenCenter = async (l: Locator) => {
  const box = await l.boundingBox();
  if (!box) throw new Error("element is not visible");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const dragBy = async (
  page: Page,
  grab: { x: number; y: number },
  dx: number,
  dy: number,
) => {
  const scale = await zoom(page);
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x + dx * scale, grab.y + dy * scale, {
    steps: 10,
  });
  await page.mouse.up();
};
const dragNodeBy = async (page: Page, id: string, dx: number, dy: number) => {
  const box = await node(page, id).boundingBox();
  if (!box) throw new Error(`${id} is not visible`);
  await dragBy(page, { x: box.x + 16, y: box.y + 16 }, dx, dy);
};
const dragGroupBy = async (page: Page, id: string, dx: number, dy: number) => {
  const box = await node(page, id).boundingBox();
  if (!box) throw new Error(`${id} is not visible`);
  await dragBy(page, { x: box.x + box.width - 30, y: box.y + 20 }, dx, dy);
};

const connect = async (
  page: Page,
  sourceId: string,
  to: { x: number; y: number },
) => {
  await node(page, sourceId).hover();
  const from = await screenCenter(
    page.locator(`[data-nodeid="${sourceId}"][data-handleid="connect-bottom"]`),
  );
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
};

const autoAlign = (page: Page) =>
  page.getByRole("button", { name: "自動整列" }).click();

test.beforeEach(async ({ page }) => {
  await page.goto("/event/test/management/graph/edit");
  await expect(
    page.getByRole("heading", { level: 2, name: "test ルート図編集" }),
  ).toBeVisible();
  await expect(allNodes(page)).toHaveCount(15);
});

test.describe("自動整列", () => {
  test("自動整列するとポイントが重ならず 2F が 1F の上に来て子はグループに収まる", async ({
    page,
  }) => {
    await dragNodeBy(page, "ph_booth", 0, 160);
    const messed = await flowBoxes(page, ["ph_booth", "ph_wall"]);
    expect(overlaps(messed.ph_booth, messed.ph_wall)).toBe(true);

    await autoAlign(page);

    await expect(allNodes(page)).toHaveCount(15);
    await expect(allEdges(page)).toHaveCount(14);
    const boxes = await flowBoxes(page, [...points, "ph_floor1", "ph_floor2"]);
    for (const [i, a] of points.entries()) {
      for (const b of points.slice(i + 1)) {
        expect(overlaps(boxes[a], boxes[b]), `${a} と ${b}`).toBe(false);
      }
    }
    expect(boxes.ph_floor2.y + boxes.ph_floor2.height).toBeLessThanOrEqual(
      boxes.ph_floor1.y,
    );
    for (const id of floor1Points) {
      expect(contains(boxes.ph_floor1, boxes[id]), id).toBe(true);
    }
    for (const id of floor2Points) {
      expect(contains(boxes.ph_floor2, boxes[id]), id).toBe(true);
    }
  });

  test("ポイントを横にずらしてから自動整列すると整列済みの位置に戻る", async ({
    page,
  }) => {
    await autoAlign(page);
    const aligned = await flowBox(node(page, "ph_booth"));

    await dragNodeBy(page, "ph_booth", 150, 0);
    const moved = await flowBox(node(page, "ph_booth"));
    expect(Math.abs(moved.x - aligned.x)).toBeGreaterThan(100);

    await autoAlign(page);

    const realigned = await flowBox(node(page, "ph_booth"));
    expect(realigned.x).toBeCloseTo(aligned.x, 0);
    expect(realigned.y).toBeCloseTo(aligned.y, 0);
  });

  test("同じ列のポイントの上下を入れ替えて自動整列すると入れ替えた順序が保たれる", async ({
    page,
  }) => {
    const before = await flowBoxes(page, ["ph_booth", "ph_wall"]);
    expect(before.ph_booth.y).toBeLessThan(before.ph_wall.y);

    await dragNodeBy(page, "ph_wall", 0, -246);
    await autoAlign(page);

    const after = await flowBoxes(page, ["ph_booth", "ph_wall"]);
    expect(after.ph_wall.y + after.ph_wall.height).toBeLessThanOrEqual(
      after.ph_booth.y,
    );
    expect(after.ph_wall.y).toBeCloseTo(before.ph_booth.y, 0);
    expect(after.ph_booth.y).toBeCloseTo(before.ph_wall.y, 0);
  });

  test("外部ポイントを遠くへ動かしてから自動整列すると入口の外側に戻る", async ({
    page,
  }) => {
    await dragNodeBy(page, "external", -100, 300);

    await autoAlign(page);

    await expect(allNodes(page)).toHaveCount(15);
    const boxes = await flowBoxes(page, [
      "external",
      "ph_entrance",
      "ph_floor1",
      "ph_floor2",
    ]);
    const left = Math.min(boxes.ph_floor1.x, boxes.ph_floor2.x);
    expect(boxes.external.x + boxes.external.width).toBeCloseTo(left - 120, 0);
    expect(boxes.external.y + boxes.external.height / 2).toBeCloseTo(
      boxes.ph_entrance.y + boxes.ph_entrance.height / 2,
      0,
    );
  });
});

test.describe("ドラッグでの接続", () => {
  test("ポイントの縁からドラッグして別のポイントで離すとルートが追加され選択される", async ({
    page,
  }) => {
    await connect(page, "ph_booth", await screenCenter(node(page, "ph_wall")));

    await expect(allEdges(page)).toHaveCount(15);
    await expect(panel(page).getByRole("code")).toHaveText(/^e_/);
    await expect(panel(page)).toContainText("ブースA⇌壁展示");
  });

  test("ポイントの角の近くで離しても接続される", async ({ page }) => {
    const wall = await node(page, "ph_wall").boundingBox();
    if (!wall) throw new Error("ph_wall is not visible");
    const offset = 27 * (await zoom(page));

    await connect(page, "ph_booth", {
      x: wall.x - offset,
      y: wall.y - offset,
    });

    await expect(allEdges(page)).toHaveCount(15);
    await expect(panel(page)).toContainText("ブースA⇌壁展示");
  });

  test("外部ポイントどうしをつなごうとしてもルートは追加されない", async ({
    page,
  }) => {
    await connect(
      page,
      "external",
      await screenCenter(node(page, "external-ph_exit")),
    );

    await expect(allEdges(page)).toHaveCount(14);
  });
});

test.describe("ルート追加モード", () => {
  test("ルートを追加モードではポイント間のドラッグでルートが追加されモードが続き Esc で終わる", async ({
    page,
  }) => {
    await page
      .locator(".react-flow__pane")
      .click({ button: "right", position: { x: 20, y: 20 } });
    await page
      .getByRole("menu", { name: "キャンバスの操作" })
      .getByRole("menuitem", { name: "ルートを追加", exact: true })
      .click();
    await expect(easyConnectPanel(page)).toBeVisible();
    const booth = await flowBox(node(page, "ph_booth"));

    const from = await screenCenter(node(page, "ph_booth"));
    const to = await screenCenter(node(page, "ph_wall"));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();

    await expect(allEdges(page)).toHaveCount(15);
    expect(await flowBox(node(page, "ph_booth"))).toEqual(booth);
    await expect(easyConnectPanel(page)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(easyConnectPanel(page)).toBeHidden();
  });

  test("このポイントからルートを追加では終点を押すだけでルートができモードが終わる", async ({
    page,
  }) => {
    await node(page, "ph_booth").click({ button: "right" });
    await page
      .getByRole("menuitem", { name: "このポイントからルートを追加" })
      .click();
    await expect(fromNodePanel(page)).toBeVisible();

    const to = await screenCenter(node(page, "ph_wall"));
    await page.mouse.click(to.x, to.y);

    await expect(allEdges(page)).toHaveCount(15);
    await expect(fromNodePanel(page)).toBeHidden();
  });

  test("このポイントからルートを追加で何もない所を押すとルートはできずモードが終わる", async ({
    page,
  }) => {
    await node(page, "ph_booth").click({ button: "right" });
    await page
      .getByRole("menuitem", { name: "このポイントからルートを追加" })
      .click();
    await expect(fromNodePanel(page)).toBeVisible();

    const pane = await page.locator(".react-flow__pane").boundingBox();
    if (!pane) throw new Error("pane is not visible");
    await page.mouse.click(pane.x + 20, pane.y + 20);

    await expect(fromNodePanel(page)).toBeHidden();
    await expect(allEdges(page)).toHaveCount(14);
  });
});

test.describe("グループへの出し入れ", () => {
  test("ポイントをグループの外へドラッグすると所属が外れグループが縮む", async ({
    page,
  }) => {
    const original = await flowBox(node(page, "ph_floor1"));

    await dragNodeBy(page, "ph_wall", 0, 200);

    const floor1 = await flowBox(node(page, "ph_floor1"));
    expect(floor1.height).toBeLessThan(original.height);
    const wall = await flowBox(node(page, "ph_wall"));
    expect(overlaps(floor1, wall)).toBe(false);

    const before = await flowBoxes(page, ["ph_floor1", "ph_booth"]);
    await dragGroupBy(page, "ph_floor1", 0, -50);

    const after = await flowBoxes(page, ["ph_floor1", "ph_booth"]);
    expect(after.ph_floor1.y).toBeLessThan(before.ph_floor1.y);
    expect(after.ph_booth.y - before.ph_booth.y).toBeCloseTo(
      after.ph_floor1.y - before.ph_floor1.y,
    );
    expect(await flowBox(node(page, "ph_wall"))).toEqual(wall);
  });

  test("ポイントを別のグループの中へドラッグするとそのグループと一緒に動く", async ({
    page,
  }) => {
    await dragNodeBy(page, "ph_gallery2f", 270, 450);
    const before = await flowBoxes(page, ["ph_floor1", "ph_gallery2f"]);
    expect(contains(before.ph_floor1, before.ph_gallery2f)).toBe(true);

    await dragGroupBy(page, "ph_floor1", 0, 50);

    const after = await flowBoxes(page, ["ph_floor1", "ph_gallery2f"]);
    expect(after.ph_floor1.y).toBeGreaterThan(before.ph_floor1.y);
    expect(after.ph_gallery2f.y - before.ph_gallery2f.y).toBeCloseTo(
      after.ph_floor1.y - before.ph_floor1.y,
    );
  });

  test("グループの中で右クリックして追加したポイントはそのグループと一緒に動く", async ({
    page,
  }) => {
    const floor1 = node(page, "ph_floor1");
    const box = await floor1.boundingBox();
    if (!box) throw new Error("ph_floor1 is not visible");
    await floor1.click({
      button: "right",
      position: { x: box.width - 150, y: 60 },
    });
    await page
      .getByRole("menu", { name: "グループ「1F」の操作" })
      .getByRole("menuitem", { name: "ポイントを追加", exact: true })
      .click();
    const added = node(
      page,
      (await panel(page).getByRole("code").textContent()) ?? "",
    );
    const before = {
      group: await flowBox(floor1),
      point: await flowBox(added),
    };
    expect(contains(before.group, before.point)).toBe(true);

    await dragGroupBy(page, "ph_floor1", 0, 50);

    const after = { group: await flowBox(floor1), point: await flowBox(added) };
    expect(after.group.y).toBeGreaterThan(before.group.y);
    expect(after.point.y - before.point.y).toBeCloseTo(
      after.group.y - before.group.y,
    );
  });

  test("グループをリサイズで内側に縮めても中のポイントははみ出さない", async ({
    page,
  }) => {
    const group = node(page, "ph_floor1");
    const box = await group.boundingBox();
    if (!box) throw new Error("ph_floor1 is not visible");
    await group.click({ position: { x: box.width - 10, y: box.height - 10 } });
    const handle = group.locator(
      ".react-flow__resize-control.handle.bottom.right",
    );
    const corner = await screenCenter(handle);

    await page.mouse.move(corner.x, corner.y);
    await page.mouse.down();
    await page.mouse.move(corner.x - 400, corner.y - 300, { steps: 10 });
    await page.mouse.up();

    const boxes = await flowBoxes(page, ["ph_floor1", ...floor1Points]);
    for (const id of floor1Points) {
      expect(contains(boxes.ph_floor1, boxes[id]), id).toBe(true);
    }
  });
});
