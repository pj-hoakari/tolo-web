import { expect, type Page, test } from "@playwright/test";
import { sampleEdgeDevicesWire } from "@/mocks/fixtures/edges";
import type { MockRouterOverrides } from "@/mocks/router";

type MockOverrides = Pick<
  MockRouterOverrides,
  "devices" | "registerEdgeDeviceError" | "unregisterEdgeDeviceError"
>;

const edgeA = "入口カメラ";
const edgeB = "3b9d77f41e2a5c08";
const offlineEdge = "ホールカメラ";

const main = (page: Page) => page.getByRole("main");
const edgeRow = (page: Page, name: string) =>
  main(page).getByRole("listitem").filter({ hasText: name });
const registerEdge = async (page: Page, name: string, points: string) => {
  await main(page).getByRole("textbox", { name: "端末名" }).fill(name);
  await main(page).getByRole("textbox", { name: "観測点名" }).fill(points);
  await main(page).getByRole("button", { name: "登録", exact: true }).click();
};
const overrideMock = async (page: Page, overrides: MockOverrides) => {
  await page.evaluate((value) => {
    sessionStorage.setItem("msw:overrides", value);
    window.dispatchEvent(new Event("msw:overrides"));
  }, JSON.stringify(overrides));
};

test.beforeEach(async ({ page }) => {
  await page.goto("/event/test/observation");
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "0123456789abcdef 観測デバイス管理",
    }),
  ).toBeVisible();
});

test("ID のない観測ページの URL を開くと観測デバイス管理ページが表示され画面ロックは出ない", async ({
  page,
}) => {
  await expect(main(page)).toContainText("エッジ（3）");
  await expect(
    page.getByRole("heading", { level: 2, name: "解除コードを設定" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "画面ロック" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "画面の常時点灯" }),
  ).toHaveCount(0);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    `/manifest.webmanifest?start=${encodeURIComponent("/event/test/observation")}`,
  );
});

test("観測デバイス管理ページの管理ページリンクを押すと管理ページに移動する", async ({
  page,
}) => {
  await page.getByRole("link", { name: "管理ページ", exact: true }).click();
  await expect(page).toHaveURL("/event/test/management");
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "0123456789abcdef 管理ページ",
    }),
  ).toBeVisible();
});

test("観測デバイス管理ページを開くとオフラインのものを含む観測デバイスの一覧が表示される", async ({
  page,
}) => {
  const list = main(page);
  await expect(list).toContainText("エッジ（3）");
  const items = list.getByRole("listitem");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText(edgeA);
  await expect(items.nth(1)).toContainText(edgeB);
  await expect(items.nth(2)).toContainText(offlineEdge);
  await expect(items.nth(2)).toContainText("オフライン");
  await expect(
    list.getByRole("button", { name: `「${offlineEdge}」に接続` }),
  ).toBeDisabled();
  await expect(
    list.getByRole("button", { name: `「${edgeA}」に接続` }),
  ).toBeEnabled();
});

test("観測デバイスの一覧には各観測デバイスの最終応答時刻が表示される", async ({
  page,
}) => {
  const items = main(page).getByRole("listitem");
  await expect(items.filter({ hasText: edgeA })).toContainText(
    "最終応答: 19:00:00",
  );
  await expect(items.filter({ hasText: edgeB })).toContainText(
    "最終応答: 19:00:05",
  );
  await expect(items.filter({ hasText: offlineEdge })).toContainText(
    "最終応答: 18:00:00",
  );
});

test("未接続の観測デバイスの行には接続ボタンと登録解除ボタンだけが表示される", async ({
  page,
}) => {
  const row = edgeRow(page, edgeA);
  await expect(row.getByRole("button")).toHaveCount(2);
  await expect(
    row.getByRole("button", { name: `「${edgeA}」に接続` }),
  ).toBeEnabled();
  await expect(
    row.getByRole("button", { name: `「${edgeA}」の登録を解除` }),
  ).toBeEnabled();
});

test("観測デバイスへの接続に失敗するとその行に接続失敗と表示され接続ボタンと閉じるボタンが出る", async ({
  page,
}) => {
  const row = edgeRow(page, edgeA);
  await row.getByRole("button", { name: `「${edgeA}」に接続` }).click();

  await expect(row).toContainText("接続失敗");
  await expect(row.getByRole("button")).toHaveCount(3);
  await expect(
    row.getByRole("button", { name: `「${edgeA}」に接続` }),
  ).toBeEnabled();
  await expect(
    row.getByRole("button", { name: `「${edgeA}」の映像を閉じる` }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
});

test("接続に失敗した観測デバイスがオフラインになっても行が残り閉じるを押すと映像の枠が消えて未接続の行に戻る", async ({
  page,
}) => {
  const list = main(page);
  const row = edgeRow(page, edgeA);
  await row.getByRole("button", { name: `「${edgeA}」に接続` }).click();
  await expect(row).toContainText("接続失敗");

  await overrideMock(page, {
    devices: sampleEdgeDevicesWire.map((device) =>
      device.name === edgeA ? { ...device, online: false } : device,
    ),
  });
  await list.getByRole("button", { name: "更新" }).click();

  await expect(row).toContainText("オフライン");
  await expect(row).toContainText("接続失敗");
  await expect(
    row.getByRole("button", { name: `「${edgeA}」に接続` }),
  ).toBeDisabled();

  await row.getByRole("button", { name: `「${edgeA}」の映像を閉じる` }).click();

  await expect(list.getByRole("alert")).toHaveCount(0);
  await expect(list).toContainText("エッジ（3）");
  await expect(row).toContainText("オフライン");
  await expect(row).not.toContainText("接続失敗");
  await expect(row.getByRole("button")).toHaveCount(2);
  await expect(
    row.getByRole("button", { name: `「${edgeA}」に接続` }),
  ).toBeDisabled();
});

test("観測デバイスを登録すると一覧に加わり発行 URL とこの端末で開くリンクが表示される", async ({
  page,
}) => {
  await registerEdge(page, "受付カメラ", "受付\n\n 出口 \n受付");

  const issuedUrl = main(page).getByRole("textbox", { name: "発行 URL" });
  await expect(issuedUrl).toHaveValue(
    /^http:\/\/test\.localhost:3100\/event\/test\/observation\/[0-9a-f]{16}$/,
  );
  await expect(main(page)).toContainText("観測点: 受付、出口");
  await expect(
    main(page).getByRole("button", { name: "URL をコピー" }),
  ).toBeVisible();
  await expect(main(page)).toContainText("エッジ（4）");
  await expect(edgeRow(page, "受付カメラ")).toContainText("オフライン");
  await expect(main(page).getByRole("textbox", { name: "端末名" })).toHaveValue(
    "",
  );

  const path = new URL(await issuedUrl.inputValue()).pathname;
  await main(page)
    .getByRole("link", { name: "この端末で開く", exact: true })
    .click();
  await expect(page).toHaveURL(path);
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "0123456789abcdef 観測ページ",
    }),
  ).toBeVisible();
});

test("観測デバイスの登録に失敗すると理由が表示され入力は残る", async ({
  page,
}) => {
  await overrideMock(page, { registerEdgeDeviceError: "BAD_REQUEST" });
  await registerEdge(page, "受付カメラ", "受付");

  await expect(main(page).getByRole("alert")).toHaveText(
    "端末名と観測点名を確認してください。",
  );
  await expect(main(page).getByRole("textbox", { name: "端末名" })).toHaveValue(
    "受付カメラ",
  );
  await expect(main(page)).toContainText("エッジ（3）");
});

test("デバイス名か観測点名が空のあいだは登録できない", async ({ page }) => {
  const submit = main(page).getByRole("button", {
    name: "登録",
    exact: true,
  });

  await expect(submit).toBeDisabled();
  await main(page).getByRole("textbox", { name: "端末名" }).fill("受付カメラ");
  await expect(submit).toBeDisabled();
  await main(page).getByRole("textbox", { name: "観測点名" }).fill(" \n ");
  await expect(submit).toBeDisabled();
  await main(page).getByRole("textbox", { name: "観測点名" }).fill("受付");
  await expect(submit).toBeEnabled();
});

test("オフラインの観測デバイスの行からその観測デバイスの観測ページを開ける", async ({
  page,
}) => {
  await expect(
    edgeRow(page, edgeA).getByRole("link", { name: /この端末で開く$/ }),
  ).toHaveCount(0);
  await edgeRow(page, offlineEdge)
    .getByRole("link", { name: `「${offlineEdge}」をこの端末で開く` })
    .click();

  await expect(page).toHaveURL("/event/test/observation/5e6f708192a3b4c5");
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "0123456789abcdef 観測ページ",
    }),
  ).toBeVisible();
});

test("登録解除を確認するとその観測デバイスが一覧から消える", async ({
  page,
}) => {
  await edgeRow(page, offlineEdge)
    .getByRole("button", { name: `「${offlineEdge}」の登録を解除` })
    .click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(`「${offlineEdge}」の登録を解除します。`);
  await dialog.getByRole("button", { name: "登録を解除する" }).click();

  await expect(dialog).toBeHidden();
  await expect(main(page)).toContainText("エッジ（2）");
  await expect(edgeRow(page, offlineEdge)).toHaveCount(0);
});

test("登録解除の確認でキャンセルすると観測デバイスは一覧に残る", async ({
  page,
}) => {
  await edgeRow(page, offlineEdge)
    .getByRole("button", { name: `「${offlineEdge}」の登録を解除` })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "キャンセル" })
    .click();

  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(main(page)).toContainText("エッジ（3）");
  await expect(edgeRow(page, offlineEdge)).toHaveCount(1);
});

test("登録解除に失敗すると確認ダイアログに理由が表示され観測デバイスは一覧に残る", async ({
  page,
}) => {
  await overrideMock(page, {
    unregisterEdgeDeviceError: "PRECONDITION_FAILED",
  });
  await edgeRow(page, offlineEdge)
    .getByRole("button", { name: `「${offlineEdge}」の登録を解除` })
    .click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "登録を解除する" }).click();

  await expect(dialog.getByRole("alert")).toHaveText(
    "端末が見つからないか、既に登録が解除されています。一覧を更新してください。",
  );
  await expect(main(page)).toContainText("エッジ（3）");
});
