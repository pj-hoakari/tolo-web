import { expect, type Page, test } from "@playwright/test";

const edgeA = "test_test_8c1f0e2a";
const edgeB = "test_test_3b9d77f4";

const panel = (page: Page) => page.getByRole("complementary");
const observationPoint = (page: Page, edgeId: string) =>
  panel(page).getByRole("group", { name: "観測点" }).getByText(edgeId);

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
  await expect(page.getByTestId("rf__node-ph_booth")).toBeVisible();
  await expect(panel(page)).toContainText(
    "観測点を紐づけるポイントまたはルートを選択してください。",
  );
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
  await page.getByTestId("rf__node-ph_booth").click();

  await expect(panel(page).getByRole("code")).toHaveText("ph_booth");
  await expect(panel(page)).toContainText("ブースA");
  await expect(
    panel(page).getByRole("checkbox", { name: edgeA }),
  ).toBeVisible();
  await expect(
    panel(page).getByRole("checkbox", { name: edgeB }),
  ).toBeVisible();
});

test("ルートを選ぶとそのルートの ID が表示される", async ({ page }) => {
  await page.getByTestId("rf__edge-ph_e2").click({ force: true });

  await expect(panel(page).getByRole("code")).toHaveText("ph_e2");
});

test("ポイントに観測点を紐づけると観測点の件数が表示される", async ({
  page,
}) => {
  await page.getByTestId("rf__node-ph_booth").click();
  await observationPoint(page, edgeA).click();

  await expect(
    panel(page).getByRole("checkbox", { name: edgeA }),
  ).toBeChecked();
  await expect(panel(page)).toContainText("観測点（1）");
});

test("あるポイントに紐づけた観測点は他のポイントでは使用中として選べない", async ({
  page,
}) => {
  await page.getByTestId("rf__node-ph_booth").click();
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
  await page.getByTestId("rf__node-ph_booth").click();
  await observationPoint(page, edgeA).click();

  await page.getByRole("tab", { name: "接続エッジ" }).click();
  await page.getByRole("tab", { name: "ルート図" }).click();
  await page.getByTestId("rf__node-ph_booth").click();

  await expect(
    panel(page).getByRole("checkbox", { name: edgeA }),
  ).toBeChecked();
});

test("ラベルの言語を English に切り替えるとポイントのラベルが英語で表示される", async ({
  page,
}) => {
  await page.getByRole("button", { name: "ラベルの言語" }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();

  await expect(page.getByTestId("rf__node-ph_booth")).toContainText("Booth A");
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
