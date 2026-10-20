import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import en from "../messages/en.json";
import ja from "../messages/ja.json";

const rootOrigin = "http://localhost:3100";
const tenantOrigin = "http://test.localhost:3100";
const installButton = (page: Page) =>
  page.getByRole("button", { name: ja.PwaInstall.button, exact: true });

// Browsers resolve *.localhost internally; Node's request client may not.
const getOriginAsset = (
  request: APIRequestContext,
  publicPath: string,
  origin: string,
) =>
  request.get(new URL(publicPath, rootOrigin).href, {
    headers: { host: new URL(origin).host },
  });

async function emulateStandalone(page: Page) {
  await page.addInitScript(() => {
    const matchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const media = matchMedia(query);
      if (query === "(display-mode: standalone)") {
        Object.defineProperty(media, "matches", { value: true });
      }
      return media;
    };
  });
}

async function emitNativePrompt(page: Page, outcome: "accepted" | "dismissed") {
  await page.evaluate((choice) => {
    const state = Object.assign(window, { pwaPromptCalls: 0 });
    const event = Object.assign(
      new Event("beforeinstallprompt", { cancelable: true }),
      {
        prompt: async () => {
          state.pwaPromptCalls += 1;
        },
        userChoice: Promise.resolve({ outcome: choice }),
      },
    );
    window.dispatchEvent(event);
  }, outcome);
}

test("root and tenant origins serve the manifest and correctly sized PNG icons", async ({
  request,
  page,
}) => {
  for (const origin of [rootOrigin, tenantOrigin]) {
    const response = await getOriginAsset(
      request,
      "/manifest.webmanifest",
      origin,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain(
      "application/manifest+json",
    );
    const manifest = await response.json();
    expect(manifest).toMatchObject({
      name: "Tolo",
      start_url: "/",
      scope: "/",
      display: "standalone",
    });
    for (const icon of manifest.icons as { src: string; sizes: string }[]) {
      const image = await getOriginAsset(request, icon.src, origin);
      expect(image.status()).toBe(200);
      expect(image.headers()["content-type"]).toContain("image/png");
      const png = await image.body();
      expect(
        png
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      ).toBe(true);
      expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(
        icon.sizes,
      );
    }
    const appleIcon = await getOriginAsset(
      request,
      "/apple-touch-icon.png",
      origin,
    );
    expect(appleIcon.status()).toBe(200);
    const applePng = await appleIcon.body();
    expect([applePng.readUInt32BE(16), applePng.readUInt32BE(20)]).toEqual([
      180, 180,
    ]);
  }

  await page.goto("/event/test/guest");
  const manifestLink = page.locator('link[rel="manifest"]');
  await expect(manifestLink).toHaveAttribute(
    "href",
    `/manifest.webmanifest?start=${encodeURIComponent("/event/test/guest")}`,
  );
  const pageManifest = await getOriginAsset(
    request,
    (await manifestLink.getAttribute("href")) ?? "",
    tenantOrigin,
  );
  expect(pageManifest.status()).toBe(200);
  expect(await pageManifest.json()).toMatchObject({
    id: "/",
    start_url: "/event/test/guest",
    scope: "/",
  });
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/apple-touch-icon.png",
  );
});

for (const [locale, messages] of [
  ["ja", ja],
  ["en", en],
] as const) {
  test(`${locale} installation instructions can be used with the keyboard and pointer`, async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: locale, url: tenantOrigin },
    ]);
    await page.goto("/event/test/guest");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    const trigger = page.getByRole("button", {
      name: messages.PwaInstall.button,
      exact: true,
    });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", {
      name: messages.PwaInstall.title,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(messages.PwaInstall.description);

    const iosGuide = dialog.getByRole("button", {
      name: messages.PwaInstall.iosTitle,
    });
    await iosGuide.focus();
    await page.keyboard.press("Enter");
    await expect(iosGuide).toHaveAttribute("aria-expanded", "true");
    await expect(
      dialog.getByText(messages.PwaInstall.iosSteps.second, { exact: true }),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: messages.PwaInstall.androidTitle })
      .click();
    await expect(
      dialog.getByText(messages.PwaInstall.androidSteps.second, {
        exact: true,
      }),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: messages.PwaInstall.close, exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}

test("navigation uses the current page's installation guide and appinstalled hides the install action", async ({
  page,
}) => {
  await page.goto("/event/test/management");
  await expect(installButton(page)).toBeVisible();
  await emitNativePrompt(page, "accepted");
  await page.getByRole("link", { name: "グラフを編集" }).click();
  await expect(page).toHaveURL("/event/test/management/graph/edit");
  await installButton(page).click();
  const dialog = page.getByRole("dialog", { name: ja.PwaInstall.title });
  await expect(
    dialog.getByRole("button", {
      name: ja.PwaInstall.nativeInstall,
      exact: true,
    }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as Window & { pwaPromptCalls?: number }).pwaPromptCalls,
    ),
  ).toBe(0);
  await dialog.getByRole("button", { name: ja.PwaInstall.close }).click();
  await emitNativePrompt(page, "accepted");
  await installButton(page).click();
  await dialog
    .getByRole("button", { name: ja.PwaInstall.nativeInstall, exact: true })
    .click();
  await expect(dialog.getByRole("status")).toHaveText(ja.PwaInstall.accepted);
  expect(
    await page.evaluate(
      () => (window as Window & { pwaPromptCalls?: number }).pwaPromptCalls,
    ),
  ).toBe(1);
  await expect(
    dialog.getByRole("button", {
      name: ja.PwaInstall.nativeInstall,
      exact: true,
    }),
  ).toHaveCount(0);

  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(installButton(page)).toHaveCount(0);
});

test("a canceled native prompt shows the fallback instructions", async ({
  page,
}) => {
  await page.goto("/event/test/guest");
  await expect(installButton(page)).toBeVisible();
  await emitNativePrompt(page, "dismissed");
  await installButton(page).click();
  const dialog = page.getByRole("dialog", { name: ja.PwaInstall.title });
  await dialog
    .getByRole("button", { name: ja.PwaInstall.nativeInstall, exact: true })
    .click();
  await expect(dialog.getByRole("status")).toHaveText(ja.PwaInstall.dismissed);
  await dialog
    .getByRole("button", { name: ja.PwaInstall.desktopTitle })
    .click();
  await expect(
    dialog.getByText(ja.PwaInstall.desktopSteps.second, { exact: true }),
  ).toBeVisible();
});

test.describe("online standalone app", () => {
  test.use({ viewport: { width: 1600, height: 1000 } });
  test.beforeEach(async ({ page }) => emulateStandalone(page));

  test("guest search works and the next launch restores its public tenant URL", async ({
    page,
  }) => {
    await page.goto("/event/test/guest");
    await expect(
      page.getByRole("heading", { level: 1, name: "0123456789abcdef" }),
    ).toBeVisible();
    await expect(installButton(page)).toHaveCount(0);
    const search = page.getByRole("textbox", { name: "目的地を検索" });
    await search.fill("たこ");
    await page.getByRole("button", { name: "たこ焼き", exact: true }).click();
    await expect(search).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "リセット", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("tolo:pwa:last-page")),
      )
      .toBe("/event/test/guest");

    await page.goto("/");
    await expect(page).toHaveURL("/event/test/guest");
    await expect(
      page.getByRole("heading", { level: 2, name: "案内マップ" }),
    ).toBeVisible();
  });

  test("management API data and graph editing work through client navigation", async ({
    page,
  }) => {
    await page.goto("/event/test/management");
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "0123456789abcdef 管理ページ",
      }),
    ).toBeVisible();
    await expect(installButton(page)).toHaveCount(0);
    const booth = page.getByTestId("rf__node-ph_booth");
    await booth.click();
    const point = page
      .getByRole("complementary")
      .getByRole("checkbox", { name: "入口", exact: true });
    await page
      .getByRole("complementary")
      .getByRole("group", { name: "観測点" })
      .getByText("入口", { exact: true })
      .click();
    await expect(point).toBeChecked();

    await page.getByRole("link", { name: "グラフを編集" }).click();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "0123456789abcdef ルート図編集",
      }),
    ).toBeVisible();
    await expect(installButton(page)).toHaveCount(0);
    await booth.click({ position: { x: 8, y: 8 } });
    await page
      .getByRole("complementary")
      .getByRole("textbox", { name: "ラベル（日本語）" })
      .fill("PWA ブース");
    await expect(booth).toContainText("PWA ブース");
    await page.getByRole("link", { name: "管理ページへ戻る" }).click();
    await expect(page).toHaveURL("/event/test/management");
  });

  test("observation/device can be unlocked, configured, and locked again", async ({
    page,
    request,
  }) => {
    const publicPath = "/event/test/observation/device";
    await page.goto(publicPath);
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "0123456789abcdef 観測ページ",
      }),
    ).toBeVisible();
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute(
      "href",
      `/manifest.webmanifest?start=${encodeURIComponent(publicPath)}`,
    );
    const manifest = await getOriginAsset(
      request,
      (await manifestLink.getAttribute("href")) ?? "",
      tenantOrigin,
    );
    expect(manifest.status()).toBe(200);
    expect(await manifest.json()).toMatchObject({
      id: "/",
      start_url: publicPath,
      scope: "/",
    });
    await page
      .getByRole("textbox", { name: "解除コード", exact: true })
      .fill("1234");
    await page
      .getByRole("textbox", { name: "解除コード（確認）" })
      .fill("1234");
    await page.getByRole("button", { name: "設定して解除" }).click();
    await expect(
      page.getByRole("button", { name: "カメラを起動" }),
    ).toBeEnabled();
    await expect(installButton(page)).toHaveCount(0);
    await page.getByRole("button", { name: "詳細調整", exact: true }).click();
    await expect(page.getByRole("spinbutton")).toHaveCount(3);
    await page.getByRole("button", { name: "画面ロック", exact: true }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: "画面ロック中" }),
    ).toBeVisible();
  });
});
