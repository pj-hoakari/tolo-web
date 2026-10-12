import { expect, test } from "@playwright/test";

const rootURL = "http://localhost:3100";

test("ルートドメインにアクセスするとトップページが表示される", async ({
  page,
}) => {
  await page.goto(`${rootURL}/`);
  await expect(page.getByText("こんにちは、世界！")).toBeVisible();
});

test("テナントとして解決できないホストにアクセスすると 404 になる", async ({
  page,
}) => {
  const response = await page.goto("http://127.0.0.1:3100/");
  expect(response?.status()).toBe(404);
});

test("内部の /tenant パスに直接アクセスすると 404 になる", async ({ page }) => {
  const response = await page.goto(`${rootURL}/tenant/test/event/test/guest`);
  expect(response?.status()).toBe(404);
});

test("テナントのサブドメインでイベントのパスにアクセスするとそのテナントのページが表示される", async ({
  page,
}) => {
  await page.goto("/event/test/guest");
  await expect(
    page.getByRole("heading", { level: 1, name: "test" }),
  ).toBeVisible();
});

test("サブドメインで言語を切り替えてもルートドメインの言語は変わらない", async ({
  page,
}) => {
  await page.goto("/event/test/guest");
  await page.getByRole("button", { name: "言語を切り替え" }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.goto(`${rootURL}/`);
  await expect(page.getByText("こんにちは、世界！")).toBeVisible();
});

test.describe("ブラウザの言語が英語のとき", () => {
  test.use({ locale: "en-US" });

  test("トップページを開くと英語で表示される", async ({ page }) => {
    await page.goto(`${rootURL}/`);
    await expect(page.getByText("Hello world!")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("NEXT_LOCALE クッキーで日本語を指定するとブラウザの言語より優先される", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "ja", url: rootURL },
    ]);
    await page.goto(`${rootURL}/`);
    await expect(page.getByText("こんにちは、世界！")).toBeVisible();
  });
});

test("テナントのサブドメインから別テナントの内部パスにアクセスすると 404 になる", async ({
  page,
}) => {
  const response = await page.goto("/tenant/other/event/test/guest");
  expect(response?.status()).toBe(404);
});

test("書き換え済みマーカーのヘッダーを偽装しても内部の /tenant パスは 404 になる", async ({
  request,
}) => {
  const response = await request.get(
    `${rootURL}/tenant/test/event/test/guest`,
    {
      headers: { "tolo-tenant-rewritten": "forged" },
    },
  );
  expect(response.status()).toBe(404);
});

test("www サブドメインにアクセスするとトップページが表示される", async ({
  page,
}) => {
  await page.goto("http://www.localhost:3100/");
  await expect(page.getByText("こんにちは、世界！")).toBeVisible();
});

test("多段のサブドメインにアクセスすると 404 になる", async ({ page }) => {
  const response = await page.goto("http://a.b.localhost:3100/");
  expect(response?.status()).toBe(404);
});

test("テナントのサブドメインのルートにアクセスすると 200 が返る", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
});
