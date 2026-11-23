import { expect, test } from "@playwright/test";
import { locales } from "@/i18n/locale";

const firstEvent = "/event/test";
const secondEvent = "/event/0000000000000002";
const deviceId = "8c1f0e2a5d4b3c6e";
const managementRoutes = [
  "/management",
  "/management/members",
  `${firstEvent}/management`,
  `${firstEvent}/management/graph/edit`,
  `${firstEvent}/management/guide-map/edit`,
  `${firstEvent}/observation`,
  `${firstEvent}/observation/${deviceId}`,
];

for (const width of [320, 768, 1440]) {
  test(`管理・観測7画面の共通レイアウトが幅 ${width}px で収まる`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const shell = page.locator("[data-management-shell]");
    const header = shell.locator("header");
    for (const path of managementRoutes) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(shell).toHaveCount(1);
      await expect(header).toHaveCount(1);
      await expect(shell.locator("main")).toHaveCount(1);
      if (path.endsWith(deviceId)) {
        const lock = page.getByRole("dialog");
        await expect(lock).toBeVisible();
        await expect
          .poll(() =>
            header.evaluate((element) => !!element.closest("[inert]")),
          )
          .toBe(true);
        await page.keyboard.press("Escape");
        await expect(lock).toBeVisible();
        await lock
          .getByRole("textbox", { name: "解除コード", exact: true })
          .fill("1234");
        await lock
          .getByRole("textbox", { name: "解除コード（確認）", exact: true })
          .fill("1234");
        await lock.getByRole("button", { name: "設定して解除" }).click();
        await expect(lock).toHaveCount(0);
      }
      if (path === "/management") {
        await expect(
          header.getByRole("heading", { name: "イベント管理" }),
        ).toBeVisible();
        await expect(
          header.getByRole("link", { name: "イベント一覧に戻る" }),
        ).toHaveCount(0);
      }
      await expect(
        header.getByRole("link", { name: "メンバー管理" }),
      ).toHaveAttribute("href", "/management/members");
      const language = header.getByRole("button", { name: "言語を切り替え" });
      const theme = header.getByRole("button", { name: "テーマを切り替え" });
      await expect(language).toBeVisible();
      await expect(theme).toBeVisible();
      const actions = await header
        .locator("a, button")
        .evaluateAll((items) =>
          items.map(
            (element) =>
              element.getAttribute("aria-label") ?? element.textContent?.trim(),
          ),
        );
      expect(actions.indexOf("メンバー管理")).toBeLessThan(
        actions.indexOf("言語を切り替え"),
      );
      expect(actions.indexOf("言語を切り替え")).toBeLessThan(
        actions.indexOf("テーマを切り替え"),
      );
      await expect
        .poll(
          () =>
            page.evaluate(
              () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth,
            ),
          { message: path },
        )
        .toBeLessThanOrEqual(0);
      if (path.endsWith("guide-map/edit")) {
        await expect(
          page.getByRole("link", { name: "管理ページへ戻る" }),
        ).toBeInViewport({ ratio: 1 });
        await expect(
          page.getByRole("button", { name: "保存", exact: true }),
        ).toBeInViewport({ ratio: 1 });
      }
      if (path.endsWith("graph/edit")) {
        const canvas = shell.locator("[data-management-canvas]");
        await expect(canvas).toBeInViewport({ ratio: 1 });
        await expect(
          page.getByRole("button", { name: "保存", exact: true }),
        ).toBeInViewport({ ratio: 1 });
      }
      if (path !== "/management") {
        const back = header.getByRole("link", { name: "イベント一覧に戻る" });
        await expect(back.locator("svg")).toBeVisible();
        await expect(back).toHaveText("");
        await back.click();
        await expect(page).toHaveURL("/management");
      }
    }
  });
}

test("同一テナント内でイベントを変えても、現在位置とリンクが表示中のイベントに切り替わる", async ({
  page,
}) => {
  await page.goto(`${firstEvent}/management`);
  const shell = page.locator("[data-management-shell]");
  const header = shell.getByRole("banner");
  const navigation = shell.getByRole("navigation", {
    name: "0123456789abcdef 管理ページ",
  });
  await expect(
    navigation.getByRole("link", { name: "案内マップを編集" }),
  ).toHaveAttribute("href", `${firstEvent}/management/guide-map/edit`);
  await header.evaluate((banner) =>
    banner.setAttribute("data-layout-instance", "existing"),
  );
  await header.getByRole("link", { name: "イベント一覧に戻る" }).click();
  await shell.getByRole("link", { name: "Event B", exact: true }).click();
  await expect(page).toHaveURL(`${secondEvent}/management`);
  await expect(header).toHaveAttribute("data-layout-instance", "existing");
  await expect(
    navigation.getByRole("link", { name: "観測デバイス管理" }),
  ).toHaveAttribute("href", `${secondEvent}/observation`);
  await navigation.getByRole("link", { name: "観測デバイス管理" }).click();
  await expect(
    shell.getByRole("heading", {
      name: "0123456789abcdef 観測デバイス管理",
    }),
  ).toBeVisible();
  await expect(
    shell.getByRole("link", { name: "管理ページ", exact: true }),
  ).toHaveAttribute("href", `${secondEvent}/management`);
});

test("ゲストルートと解決できないテナントには管理レイアウトが表示されない", async ({
  page,
}) => {
  const shell = page.locator("[data-management-shell]");
  for (const path of [`${firstEvent}/guest`, `${firstEvent}/guest/location`]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(shell).toHaveCount(0);
  }
  const otherTenant = new URL(page.url());
  otherTenant.hostname = "unknown.localhost";
  otherTenant.pathname = "/management";
  const response = await page.goto(otherTenant.href);
  expect(response?.status()).toBe(404);
  await expect(shell).toHaveCount(0);
});

test("管理ヘッダーとナビゲーションが7ロケールで描画される", async ({
  page,
  context,
  baseURL,
}) => {
  if (!baseURL) throw new Error("A tenant base URL is required");
  await page.setViewportSize({ width: 320, height: 900 });
  const header = page.locator("[data-management-shell] header");
  const listLink = header
    .getByRole("link")
    .and(header.locator('a[href="/management"]'));

  for (const locale of locales) {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: locale, url: baseURL },
    ]);
    await page.goto("/management/members");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(listLink).toHaveAttribute("href", "/management");
    await expect(listLink).toHaveAccessibleName(/\S/);
    await expect(listLink).toBeInViewport({ ratio: 1 });
  }
});
