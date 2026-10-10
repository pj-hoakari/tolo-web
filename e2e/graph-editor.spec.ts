import { expect, type Page, test } from "@playwright/test";

test.use({ viewport: { width: 1600, height: 1000 } });

const panel = (page: Page) => page.getByRole("complementary");
const booth = (page: Page) => page.getByTestId("rf__node-ph_booth");
const selectBooth = (page: Page) =>
  booth(page).click({ position: { x: 8, y: 8 } });
const routeToBooth = (page: Page) => page.getByTestId("rf__edge-ph_e2");
const node = (page: Page, id: string) => page.getByTestId(`rf__node-${id}`);
const allNodes = (page: Page) => page.locator(".react-flow__node");
const allEdges = (page: Page) => page.locator(".react-flow__edge");
const pane = (page: Page) => page.locator(".react-flow__pane");
const emptyNotice = "ポイントまたはルートを選択してください。";
const labelField = (page: Page) =>
  panel(page).getByRole("textbox", { name: "ラベル（日本語）" });
const selectFloor1 = async (page: Page) => {
  const floor1 = node(page, "ph_floor1");
  const box = await floor1.boundingBox();
  if (!box) throw new Error("ph_floor1 is not visible");
  await floor1.click({ position: { x: box.width - 10, y: box.height - 10 } });
  await expect(
    panel(page).getByRole("button", { name: "グループを解除" }),
  ).toBeVisible();
};
const openCanvasMenu = async (
  page: Page,
  position: { x: number; y: number },
) => {
  await pane(page).click({ button: "right", position });
  return page.getByRole("menu", { name: "キャンバスの操作" });
};

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

for (const { type, radio } of [
  { type: "目的地 / 通過", radio: /^目的地 \/ 通過 例:/ },
  { type: "通過のみ", radio: /^通過のみ 例:/ },
]) {
  test(`${type}を追加するとそのタイプのポイントが選択された状態で追加される`, async ({
    page,
  }) => {
    await page.getByRole("button", { name: `${type}を追加` }).click();

    await expect(allNodes(page)).toHaveCount(16);
    await expect(labelField(page)).toHaveValue("ポイント 12");
    await expect(panel(page).getByRole("radio", { name: radio })).toBeChecked();
  });
}

test("外部を追加すると外部ポイントが選択された状態で追加される", async ({
  page,
}) => {
  await page.getByRole("button", { name: "外部を追加" }).click();

  await expect(allNodes(page)).toHaveCount(16);
  await expect(panel(page)).toContainText("会場の外を表す仮想ポイントです。");
  await expect(panel(page).getByRole("code")).toHaveText(/^n_/);
});

test("右クリックした位置にポイントを追加できる", async ({ page }) => {
  const position = { x: 300, y: 200 };
  const paneBox = await pane(page).boundingBox();
  if (!paneBox) throw new Error("pane is not visible");

  const menu = await openCanvasMenu(page, position);
  await menu
    .getByRole("menuitem", { name: "ポイントを追加", exact: true })
    .click();

  await expect(allNodes(page)).toHaveCount(16);
  await expect(labelField(page)).toHaveValue("ポイント 12");
  const addedId = await panel(page).getByRole("code").textContent();
  const added = await node(page, addedId ?? "").boundingBox();
  if (!added) throw new Error("added point is not visible");
  expect(
    Math.abs(added.x + added.width / 2 - (paneBox.x + position.x)),
  ).toBeLessThanOrEqual(3);
  expect(
    Math.abs(added.y + added.height / 2 - (paneBox.y + position.y)),
  ).toBeLessThanOrEqual(3);
});

test("右クリックからグループを追加できる", async ({ page }) => {
  const menu = await openCanvasMenu(page, { x: 300, y: 200 });
  await menu
    .getByRole("menuitem", { name: "グループを追加", exact: true })
    .click();

  await expect(allNodes(page)).toHaveCount(16);
  await expect(labelField(page)).toHaveValue("グループ 3");
});

test("外部ポイントが 1 つだけのときに右クリックで外部ポイントを足すと残っていた外部ポイントも削除できるようになる", async ({
  page,
}) => {
  await node(page, "external").click();
  await page.keyboard.press("Delete");
  await node(page, "external-ph_exit").click();
  await expect(
    panel(page).getByRole("button", { name: "このポイントを削除" }),
  ).toHaveCount(0);

  const menu = await openCanvasMenu(page, { x: 300, y: 200 });
  await menu.getByRole("menuitem", { name: "外部ポイントを追加" }).click();
  await node(page, "external-ph_exit").click();

  await expect(
    panel(page).getByRole("button", { name: "このポイントを削除" }),
  ).toBeVisible();
});

test("最後の外部ポイントには右クリックにもプロパティにも削除とタイプ変更が出ない", async ({
  page,
}) => {
  await node(page, "external").click();
  await page.keyboard.press("Delete");
  const last = node(page, "external-ph_exit");

  await last.click();
  await expect(panel(page).getByRole("code")).toHaveText("external-ph_exit");
  await expect(
    panel(page).getByRole("button", { name: "このポイントを削除" }),
  ).toHaveCount(0);
  await expect(panel(page).getByRole("radio")).toHaveCount(0);

  await last.click({ button: "right" });
  const menu = page.getByRole("menu", { name: /^ポイント「.*」の操作$/ });
  await expect(
    menu.getByRole("menuitem", { name: "このポイントからルートを追加" }),
  ).toBeVisible();
  await expect(
    menu.getByRole("menuitem", { name: "このポイントを削除" }),
  ).toHaveCount(0);
  await expect(menu.getByRole("menuitemradio")).toHaveCount(0);
});

test("ポイントを選んで Backspace キーを押すとそのポイントが消える", async ({
  page,
}) => {
  await selectBooth(page);
  await page.keyboard.press("Backspace");

  await expect(booth(page)).toHaveCount(0);
});

test("プロパティの削除ボタンを押すとポイントとそのルートが消え選択が解除される", async ({
  page,
}) => {
  await selectBooth(page);

  await panel(page).getByRole("button", { name: "このポイントを削除" }).click();

  await expect(booth(page)).toHaveCount(0);
  await expect(routeToBooth(page)).toHaveCount(0);
  await expect(panel(page)).toContainText(emptyNotice);
});

test("プロパティのラベル欄で Backspace を押してもポイントは削除されない", async ({
  page,
}) => {
  await selectBooth(page);
  await labelField(page).press("End");
  await labelField(page).press("Backspace");

  await expect(labelField(page)).toHaveValue("ブース");
  await expect(booth(page)).toBeVisible();
});

test("何もない所をクリックすると選択が解除される", async ({ page }) => {
  await selectBooth(page);
  await expect(panel(page).getByRole("code")).toHaveText("ph_booth");

  await pane(page).click({ position: { x: 20, y: 20 } });

  await expect(panel(page)).toContainText(emptyNotice);
});

test("ラベルの言語を 한국어 にして入力するとその言語のラベルだけが設定され日本語に戻すと元のラベルになる", async ({
  page,
}) => {
  const localeButton = page.getByRole("button", { name: "ラベルの言語" });
  await localeButton.click();
  const korean = page.getByRole("menuitemradio", { name: /^한국어/ });
  await expect(korean).toContainText("0/13");
  await korean.click();

  await selectBooth(page);
  await panel(page)
    .getByRole("textbox", { name: "ラベル（한국어）" })
    .fill("부스A");
  await expect(booth(page)).toContainText("부스A");

  await localeButton.click();
  await expect(
    page.getByRole("menuitemradio", { name: /^한국어/ }),
  ).toContainText("1/13");
  await page.getByRole("menuitemradio", { name: /^日本語/ }).click();

  await expect(booth(page)).toContainText("ブースA");
  await expect(labelField(page)).toHaveValue("ブースA");
});

test("ラベルを空にすると他の言語のラベルが代わりに表示される", async ({
  page,
}) => {
  await selectBooth(page);

  await labelField(page).fill("");

  await expect(booth(page)).toContainText("Booth A");
});

test("グループのラベルをその場で編集すると確定しそのグループが選択される", async ({
  page,
}) => {
  await page.getByRole("button", { name: "「1F」のラベルを編集" }).click();
  await node(page, "ph_floor1")
    .getByRole("textbox", { name: "グループのラベル（日本語）" })
    .fill("1階");
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("button", { name: "「1階」のラベルを編集" }),
  ).toBeVisible();
  await expect(panel(page).getByRole("code")).toHaveText("ph_floor1");
  await expect(labelField(page)).toHaveValue("1階");
});

test("プロパティでタイプを変えるとキャンバスのタイプ表示が変わる", async ({
  page,
}) => {
  await selectBooth(page);

  await panel(page)
    .getByRole("radio", { name: /^通過のみ 例:/ })
    .click();

  await expect(
    booth(page).getByText("通過のみ", { exact: true }),
  ).toBeVisible();
  await expect(booth(page).getByText("目的地", { exact: true })).toHaveCount(0);
});

test("ポイントの操作メニューでタイプを変えるとキャンバスのタイプ表示が変わり次に開くと選択済みになる", async ({
  page,
}) => {
  const menu = page.getByRole("menu", { name: "ポイント「ブースA」の操作" });
  await booth(page).click({ button: "right" });
  await menu.getByRole("menuitemradio", { name: "通過のみ" }).click();

  await expect(
    booth(page).getByText("通過のみ", { exact: true }),
  ).toBeVisible();

  await booth(page).click({ button: "right" });
  await expect(
    menu.getByRole("menuitemradio", { name: "通過のみ" }),
  ).toHaveAttribute("aria-checked", "true");
});

for (const { via, dissolve } of [
  {
    via: "プロパティのボタン",
    dissolve: (page: Page) =>
      panel(page).getByRole("button", { name: "グループを解除" }).click(),
  },
  {
    via: "右クリックの操作メニュー",
    dissolve: async (page: Page) => {
      const floor1 = node(page, "ph_floor1");
      const box = await floor1.boundingBox();
      if (!box) throw new Error("ph_floor1 is not visible");
      await floor1.click({
        button: "right",
        position: { x: box.width - 10, y: box.height - 10 },
      });
      await page
        .getByRole("menuitem", { name: "グループを解除（中身は残す）" })
        .click();
    },
  },
]) {
  test(`グループを${via}で解除すると中のポイントとルートは残る`, async ({
    page,
  }) => {
    await selectFloor1(page);

    await dissolve(page);

    await expect(node(page, "ph_floor1")).toHaveCount(0);
    await expect(allNodes(page)).toHaveCount(14);
    await expect(allEdges(page)).toHaveCount(14);
  });
}

test("グループを選んで Delete キーを押すとグループだけが解除され中のポイントとルートは残る", async ({
  page,
}) => {
  test.fail();
  await selectFloor1(page);

  await page.keyboard.press("Delete");

  await expect(node(page, "ph_floor1")).toHaveCount(0);
  await expect(allNodes(page)).toHaveCount(14);
  await expect(allEdges(page)).toHaveCount(14);
});
