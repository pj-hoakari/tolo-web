import { expect, type Page, test } from "@playwright/test";

const edgeA = "test_test_8c1f0e2a";
const edgeB = "test_test_3b9d77f4";

const panel = (page: Page) => page.getByRole("complementary");
const observationPoint = (page: Page, edgeId: string) =>
  panel(page).getByRole("group", { name: "観測点" }).getByText(edgeId);
const emptyNotice = "観測点を紐づけるポイントまたはルートを選択してください。";
const booth = (page: Page) => page.getByTestId("rf__node-ph_booth");
const nodeTransform = (page: Page, id: string) =>
  page
    .getByTestId(`rf__node-${id}`)
    .evaluate((el: HTMLElement) => el.style.transform);

test.beforeEach(async ({ page }) => {
  await page.goto("/event/test/management");
  await expect(
    page.getByRole("heading", { level: 2, name: "test 管理ページ" }),
  ).toBeVisible();
});

test("管理ページを開くとルート図タブが選択された状態で表示される", async ({
  page,
}) => {
  await expect(page.getByRole("tab", { name: "ルート図" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(booth(page)).toBeVisible();
  await expect(panel(page)).toContainText(emptyNotice);
});

test("グラフを編集リンクを押すとルート図編集ページに移動する", async ({
  page,
}) => {
  await page.getByRole("link", { name: "グラフを編集" }).click();
  await expect(page).toHaveURL("/event/test/management/graph/edit");
  await expect(
    page.getByRole("heading", { level: 2, name: "test ルート図編集" }),
  ).toBeVisible();
});

test("ポイントを選ぶとそのポイントの情報と接続中の観測点が表示される", async ({
  page,
}) => {
  await booth(page).click();

  await expect(panel(page).getByRole("code")).toHaveText("ph_booth");
  await expect(panel(page)).toContainText("ブースA");
  await expect(
    panel(page).getByRole("checkbox", { name: edgeA }),
  ).toBeVisible();
  await expect(
    panel(page).getByRole("checkbox", { name: edgeB }),
  ).toBeVisible();
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
  await observationPoint(page, edgeA).click();
  await expect(
    panel(page).getByRole("checkbox", { name: edgeA }),
  ).toBeChecked();

  await booth(page).click();

  await expect(
    panel(page).getByRole("checkbox", {
      name: `${edgeA} 他のポイント / ルートで使用中`,
    }),
  ).toBeDisabled();
});

test("観測点の紐づけを外すと他のポイントで再び選べる", async ({ page }) => {
  await booth(page).click();
  await observationPoint(page, edgeA).click();
  await observationPoint(page, edgeA).click();
  await expect(
    panel(page).getByRole("checkbox", { name: edgeA }),
  ).not.toBeChecked();

  await page.getByTestId("rf__node-ph_wall").click();

  await expect(
    panel(page).getByRole("checkbox", { name: edgeA }),
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
  test.fail();
  await booth(page).focus();
  await page.keyboard.press("Enter");

  await expect(panel(page).getByRole("code")).toHaveText("ph_booth");
});

test("ポイントに観測点を紐づけると観測点の件数が表示される", async ({
  page,
}) => {
  await booth(page).click();
  await observationPoint(page, edgeA).click();

  await expect(
    panel(page).getByRole("checkbox", { name: edgeA }),
  ).toBeChecked();
  await expect(panel(page)).toContainText("観測点（1）");
});

test("あるポイントに紐づけた観測点は他のポイントでは使用中として選べない", async ({
  page,
}) => {
  await booth(page).click();
  await observationPoint(page, edgeA).click();

  await page.getByTestId("rf__node-ph_wall").click();

  await expect(
    panel(page).getByRole("checkbox", {
      name: `${edgeA} 他のポイント / ルートで使用中`,
    }),
  ).toBeDisabled();
  await expect(
    panel(page).getByRole("checkbox", { name: edgeB }),
  ).toBeEnabled();
});

test("観測点の紐づけはタブを切り替えても保持される", async ({ page }) => {
  await booth(page).click();
  await observationPoint(page, edgeA).click();

  await page.getByRole("tab", { name: "接続エッジ" }).click();
  await page.getByRole("tab", { name: "ルート図" }).click();
  await booth(page).click();

  await expect(
    panel(page).getByRole("checkbox", { name: edgeA }),
  ).toBeChecked();
});

test("ラベルの言語を English に切り替えるとポイントのラベルが英語で表示される", async ({
  page,
}) => {
  await page.getByRole("button", { name: "ラベルの言語" }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();

  await expect(booth(page)).toContainText("Booth A");
});

test("接続エッジタブを開くと接続中のエッジの一覧が表示される", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "接続エッジ" }).click();

  const tabpanel = page.getByRole("tabpanel", { name: "接続エッジ" });
  await expect(tabpanel).toContainText("接続中のエッジ（2）");
  await expect(tabpanel.getByRole("listitem")).toHaveCount(2);
  await expect(tabpanel).toContainText(edgeA);
  await expect(tabpanel).toContainText(edgeB);
});

test("接続エッジの一覧には各エッジの最終応答時刻が表示される", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "接続エッジ" }).click();

  const items = page
    .getByRole("tabpanel", { name: "接続エッジ" })
    .getByRole("listitem");
  await expect(items.filter({ hasText: edgeA })).toContainText(
    "最終応答: 19:00:00",
  );
  await expect(items.filter({ hasText: edgeB })).toContainText(
    "最終応答: 19:00:05",
  );
});
