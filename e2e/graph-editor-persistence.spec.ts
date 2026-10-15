import { expect, type Page, test } from "@playwright/test";
import type { MockRouterOverrides } from "@/mocks/router";

test.use({ viewport: { width: 1600, height: 1000 } });

type MockOverrides = Pick<
  MockRouterOverrides,
  "getGraphError" | "saveGraphError"
>;
type SavedNode = { id: string; data: { labels: Record<string, string> } };

const editPath = "/event/test/management/graph/edit";
const panel = (page: Page) => page.getByRole("complementary");
const booth = (page: Page) => page.getByTestId("rf__node-ph_booth");
const saveError = (page: Page) =>
  page.getByRole("alert").filter({ hasText: "保存" });
const saveButton = (page: Page) =>
  page.getByRole("button", { name: "保存", exact: true });

const open = async (page: Page, overrides?: MockOverrides) => {
  if (overrides) {
    await page.addInitScript((value) => {
      sessionStorage.setItem("msw:overrides", value);
    }, JSON.stringify(overrides));
  }
  await page.goto(editPath);
};

test("編集ページを開くとイベントのグラフを取得してキャンバスに表示する", async ({
  page,
}) => {
  const request = page.waitForRequest("**/rpc/graph/getGraph");

  await open(page);

  expect((await request).postDataJSON()).toEqual({
    json: { eventId: "test" },
  });
  await expect(page.locator(".react-flow__node")).toHaveCount(15);
  await expect(page.locator(".react-flow__edge")).toHaveCount(14);
  await expect(booth(page)).toContainText("ブースA");
});

test("グラフの取得に失敗すると失敗の表示と再試行ボタンが出る", async ({
  page,
}) => {
  await open(page, { getGraphError: true });

  const status = page.getByRole("status");
  await expect(status).toContainText("グラフの取得に失敗しました");
  await expect(status.getByRole("button", { name: "再試行" })).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
});

test("保存を押すと編集後のグラフを送り保存しましたと表示する", async ({
  page,
}) => {
  await open(page);
  await booth(page).click({ position: { x: 8, y: 8 } });
  await panel(page)
    .getByRole("textbox", { name: "ラベル（日本語）" })
    .fill("ブースZ");
  const request = page.waitForRequest("**/rpc/graph/saveGraph");

  await saveButton(page).click();

  const { json } = (await request).postDataJSON();
  expect(json.eventId).toBe("test");
  expect(json.graph.nodes).toHaveLength(15);
  expect(json.graph.edges).toHaveLength(14);
  expect(
    json.graph.nodes.find((n: SavedNode) => n.id === "ph_booth").data.labels.ja,
  ).toBe("ブースZ");
  await expect(page.getByRole("status")).toHaveText("保存しました");
  await expect(saveError(page)).toHaveCount(0);
});

test("保存が構造検証で弾かれると理由を表示し該当するポイントを選択する", async ({
  page,
}) => {
  const message = 'point "ph_booth" has no route';
  await open(page, {
    saveGraphError: {
      message,
      violations: [
        {
          kind: "NODE_WITHOUT_ROUTE",
          elementKind: "node",
          elementId: "ph_booth",
          relatedIds: [],
        },
      ],
    },
  });
  await expect(panel(page)).toContainText(
    "ポイントまたはルートを選択してください。",
  );

  await saveButton(page).click();

  await expect(saveError(page)).toContainText(
    "ルート図に保存できない箇所があります",
  );
  await expect(saveError(page)).toContainText(message);
  await expect(panel(page).getByRole("code")).toHaveText("ph_booth");
  await expect(page.getByRole("status")).not.toHaveText("保存しました");
});
