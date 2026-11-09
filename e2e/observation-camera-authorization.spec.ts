import { expect, type Page, test } from "@playwright/test";
import { sampleObservationDevicesWire } from "@/mocks/fixtures/edges";
import type { MockRouterOverrides } from "@/mocks/router";

const samplePagePath = "/event/test/observation/8c1f0e2a5d4b3c6e";
const pageEdgeDeviceId = "8c1f0e2a5d4b3c6e";

test("カメラ一覧の取得失敗時は内蔵カメラを使わず、再取得できる", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("msw:overrides", JSON.stringify({ devices: [] }));
  });
  await page.goto(samplePagePath);
  await page
    .getByRole("textbox", { name: "解除コード", exact: true })
    .fill("1234");
  await page.getByRole("textbox", { name: "解除コード（確認）" }).fill("1234");
  await page.getByRole("button", { name: "設定して解除" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "映像ソースの取得に失敗しました" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "カメラを起動" })).toHaveCount(
    0,
  );

  await page.evaluate((devices) => {
    sessionStorage.setItem("msw:overrides", JSON.stringify({ devices }));
    window.dispatchEvent(new Event("msw:overrides"));
  }, sampleObservationDevicesWire);
  await page.getByRole("button", { name: "再接続", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: /ESP32 カメラ/ }).first(),
  ).toBeVisible();
});

const setConnectionAuthorizationError = async (
  page: Page,
  viewerType: "staff" | "machine",
) => {
  const overrides: MockRouterOverrides = {
    devices: sampleObservationDevicesWire,
    requestCameraConnectionError: { viewerType },
  };
  await page.addInitScript((value) => {
    sessionStorage.setItem("msw:overrides", value);
  }, JSON.stringify(overrides));
};

const watchConnectionStart = (page: Page) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/auth/connection/start") {
      requests.push(request.url());
    }
  });
  return requests;
};

test("スタッフの観測ページは接続認可が必要になると自動で認可を開始する", async ({
  page,
}) => {
  await setConnectionAuthorizationError(page, "staff");
  const requests = watchConnectionStart(page);

  await page.goto(samplePagePath);

  await expect.poll(() => requests.length).toBe(1);
  const startUrl = new URL(requests[0]);
  expect(startUrl.pathname).toBe("/api/auth/connection/start");
  expect(startUrl.searchParams.get("eventId")).toBe("test");
  expect(startUrl.searchParams.get("pageEdgeDeviceId")).toBe(pageEdgeDeviceId);
  expect(startUrl.searchParams.get("return")).toBe(samplePagePath);

  await page.waitForTimeout(500);
  expect(requests).toHaveLength(1);
});

test("マシンの観測ページは認可を開始せず、スタッフによる管理画面からの再認可を案内する", async ({
  page,
}) => {
  await setConnectionAuthorizationError(page, "machine");
  const requests = watchConnectionStart(page);

  await page.goto(samplePagePath);

  await expect(
    page.getByText(
      "カメラ接続の認可がありません。スタッフが管理画面の「観測ページの接続を許可」から再認可してください。",
      { exact: true },
    ),
  ).toBeVisible();
  await page.waitForTimeout(500);
  expect(requests).toHaveLength(0);
  expect(page.url()).toContain(samplePagePath);
});

test("カメラごとの再接続ボタンを日本語と英語で表示する", async ({
  page,
  context,
}) => {
  await setConnectionAuthorizationError(page, "machine");
  for (const [locale, buttonName] of [
    ["ja", "ESP32 カメラ に再接続"],
    ["en", "Reconnect ESP32 カメラ"],
  ]) {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: locale, url: "http://test.localhost:3100" },
    ]);
    await page.goto(samplePagePath);
    await expect(
      page.getByRole("button", { name: buttonName, exact: true }),
    ).toBeVisible();
  }
});
