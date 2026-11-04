import { expect, type Page, test } from "@playwright/test";
import { sampleObservationDevicesWire } from "@/mocks/fixtures/edges";
import type { MockRouterOverrides } from "@/mocks/router";

const samplePagePath = "/event/test/observation/8c1f0e2a5d4b3c6e";
const pageEdgeDeviceId = "8c1f0e2a5d4b3c6e";

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
    page.getByRole("alert").filter({
      hasText:
        "スタッフが管理画面の「観測ページの接続を許可」から再認可してください。",
    }),
  ).toBeVisible();
  await page.waitForTimeout(500);
  expect(requests).toHaveLength(0);
  expect(page.url()).toContain(samplePagePath);
});
