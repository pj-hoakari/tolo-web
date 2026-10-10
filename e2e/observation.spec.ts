import { expect, type Page, test } from "@playwright/test";

test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

const code = (page: Page) =>
  page.getByRole("textbox", { name: "解除コード", exact: true });
const confirmation = (page: Page) =>
  page.getByRole("textbox", { name: "解除コード（確認）" });
const lockButton = (page: Page) =>
  page.getByRole("button", { name: "画面ロック" });

const setUpUnlockCode = async (page: Page, value: string) => {
  await code(page).fill(value);
  await confirmation(page).fill(value);
  await page.getByRole("button", { name: "設定して解除" }).click();
  await expect(lockButton(page)).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await page.goto("/event/test/observation");
  await expect(
    page.getByRole("heading", { level: 2, name: "test 観測ページ" }),
  ).toBeVisible();
});

test.describe("画面ロック", () => {
  test("初めて観測ページを開くと解除コードの設定を求められページは操作できない", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { level: 2, name: "解除コードを設定" }),
    ).toBeVisible();
    await expect(
      page.locator("[inert]").getByRole("button", { name: "カメラを起動" }),
    ).toHaveCount(1);
  });

  test("4 文字未満の解除コードを設定しようとすると文字数不足のエラーが表示される", async ({
    page,
  }) => {
    await code(page).fill("123");
    await confirmation(page).fill("123");
    await page.getByRole("button", { name: "設定して解除" }).click();

    await expect(
      page.getByText("解除コードは4文字以上で入力してください"),
    ).toBeVisible();
    await expect(lockButton(page)).toBeHidden();
  });

  test("確認用の解除コードが一致しないと不一致のエラーが表示される", async ({
    page,
  }) => {
    await code(page).fill("1234");
    await confirmation(page).fill("1235");
    await page.getByRole("button", { name: "設定して解除" }).click();

    await expect(
      page.getByText("確認用の解除コードが一致しません"),
    ).toBeVisible();
    await expect(lockButton(page)).toBeHidden();
  });

  test("解除コードを設定するとロックが解除されページを操作できるようになる", async ({
    page,
  }) => {
    await setUpUnlockCode(page, "1234");

    await expect(page.locator("[inert]")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "カメラを起動" }),
    ).toBeEnabled();
  });

  test("画面ロックを押すとロック中になり設定済みの解除コードで解除できる", async ({
    page,
  }) => {
    await setUpUnlockCode(page, "1234");

    await lockButton(page).click();
    await expect(
      page.getByRole("heading", { level: 2, name: "画面ロック中" }),
    ).toBeVisible();

    await code(page).fill("1234");
    await page.getByRole("button", { name: "ロック解除" }).click();
    await expect(lockButton(page)).toBeVisible();
  });

  test("ロック中に誤った解除コードを入力するとエラーが表示されロックは解除されない", async ({
    page,
  }) => {
    await setUpUnlockCode(page, "1234");
    await lockButton(page).click();

    await code(page).fill("9999");
    await page.getByRole("button", { name: "ロック解除" }).click();

    await expect(page.getByText("解除コードが正しくありません")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "画面ロック中" }),
    ).toBeVisible();
  });

  test("解除コードを設定した後に再読み込みするとロック中の状態で開く", async ({
    page,
  }) => {
    await setUpUnlockCode(page, "1234");

    await page.reload();

    await expect(
      page.getByRole("heading", { level: 2, name: "画面ロック中" }),
    ).toBeVisible();
    await expect(confirmation(page)).toHaveCount(0);
  });
});

test.describe("検出設定", () => {
  test.beforeEach(async ({ page }) => {
    await setUpUnlockCode(page, "1234");
  });

  test("選択ラインの名前を変えるとラインの表示名が変わる", async ({ page }) => {
    await page
      .getByRole("textbox", { name: "選択ラインの名前" })
      .fill("ホールA入口");

    await expect(
      page.getByRole("button", { name: "ホールA入口: forward 0 / backward 0" }),
    ).toBeVisible();
  });

  for (const { preset, field, value } of [
    { preset: "厳しめ", field: "検出感度", value: "0.3" },
    { preset: "追従優先", field: "追跡のつながりやすさ", value: "0.95" },
    { preset: "省負荷", field: "検出間隔 ms", value: "250" },
  ]) {
    test(`プリセット「${preset}」を選ぶと詳細調整の「${field}」が ${value} になる`, async ({
      page,
    }) => {
      await page.getByRole("button", { name: preset }).click();
      await page.getByRole("button", { name: "詳細調整" }).click();

      await expect(page.getByRole("spinbutton", { name: field })).toHaveValue(
        value,
      );
    });
  }
});

test.describe("検出の開始", () => {
  test.use({ permissions: ["camera"] });

  test("検出モデルを取得できないときにカメラを起動すると検出状態がエラーになり理由が表示される", async ({
    page,
    context,
  }) => {
    await context.route("**/models/*.onnx", (route) =>
      route.fulfill({ status: 404 }),
    );
    await setUpUnlockCode(page, "1234");

    await page.getByRole("button", { name: "カメラを起動" }).click();

    await expect(page.getByText("検出状態: エラー")).toBeVisible();
    await expect(
      page.getByText(
        "検出モデルの読み込みに失敗しました（404: /models/yolo26n.onnx）",
      ),
    ).toBeVisible();
  });
});
