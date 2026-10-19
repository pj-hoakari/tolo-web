import { expect, type Page, test } from "@playwright/test";
import { MOCK_SERVER_MESSAGE, type MockRouterOverrides } from "@/mocks/router";

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

test("保存が構造検証で弾かれると違反の種類ごとの理由を表示し該当するポイントを選択する", async ({
  page,
}) => {
  await open(page, {
    saveGraphError: {
      code: "BAD_REQUEST",
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

  await expect(saveError(page).locator("p")).toHaveText([
    "ルート図に保存できない箇所があります",
    "ルートがつながっていないポイントがあります。",
  ]);
  await expect(page.getByText(MOCK_SERVER_MESSAGE)).toHaveCount(0);
  await expect(panel(page).getByRole("code")).toHaveText("ph_booth");
  await expect(page.getByRole("status")).not.toHaveText("保存しました");
});

test("同じ種類の違反は理由を 1 行にまとめ、知らない種類の違反は汎用の理由で表示する", async ({
  page,
}) => {
  await open(page, {
    saveGraphError: {
      code: "BAD_REQUEST",
      violations: [
        {
          kind: "NODE_WITHOUT_ROUTE",
          elementKind: "node",
          elementId: "ph_booth",
          relatedIds: [],
        },
        {
          kind: "NODE_WITHOUT_ROUTE",
          elementKind: "node",
          elementId: "ph_exit",
          relatedIds: [],
        },
        {
          kind: "SELF_LOOP_EDGE",
          elementKind: "edge",
          elementId: "ph_e1",
          relatedIds: [],
        },
        {
          kind: "KIND_FROM_A_NEWER_SERVER",
          elementKind: null,
          elementId: "",
          relatedIds: [],
        },
      ],
    },
  });

  await saveButton(page).click();

  await expect(saveError(page).locator("p")).toHaveText([
    "ルート図に保存できない箇所があります",
    "ルートがつながっていないポイントがあります。",
    "始点と終点が同じルートがあります。",
    "ルート図の構造に問題があります。",
  ]);
  await expect(page.getByText(MOCK_SERVER_MESSAGE)).toHaveCount(0);
});

for (const { name, code, message } of [
  {
    name: "イベントが見つからないかアーカイブ済みで保存できないと、復元してから編集するよう表示する",
    code: "PRECONDITION_FAILED",
    message:
      "イベントが見つからないか、アーカイブ済みのため保存できませんでした。アーカイブ済みの場合は復元してから編集してください。",
  },
  {
    name: "違反の詳細がないまま保存が拒否されると、汎用の保存失敗を表示する",
    code: "BAD_REQUEST",
    message: "保存に失敗しました。時間をおいてもう一度お試しください。",
  },
] as const) {
  test(name, async ({ page }) => {
    await open(page, { saveGraphError: { code } });

    await saveButton(page).click();

    await expect(saveError(page)).toHaveText(message);
    await expect(page.getByText(MOCK_SERVER_MESSAGE)).toHaveCount(0);
    await expect(page.getByRole("status")).not.toHaveText("保存しました");
  });
}
