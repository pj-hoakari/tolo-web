import { devices, expect, type Page, test } from "@playwright/test";
import {
  createStaffStorageScope,
  scopeStaffStorageKey,
} from "@/lib/pwa/staff-storage";
import en from "../messages/en.json";
import ja from "../messages/ja.json";

async function standalone(page: Page) {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const result = original(query);
      if (query === "(display-mode: standalone)") {
        Object.defineProperty(result, "matches", { value: true });
      }
      return result;
    };
  });
}

for (const mode of ["browser", "standalone"] as const) {
  test.describe(`staff ${mode}`, () => {
    test.use({
      viewport: { width: 390, height: 844 },
      userAgent: devices["Pixel 7"].userAgent,
      deviceScaleFactor: devices["Pixel 7"].deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
    });
    test.beforeEach(async ({ page }) => {
      if (mode === "standalone") await standalone(page);
    });

    test("A pages promote a stable staff entry and B/C pages do not promote installation", async ({
      page,
      request,
    }) => {
      await page.goto("/management");
      await expect(
        page.getByRole("heading", { name: "イベント管理", exact: true }),
      ).toBeVisible();
      const link = page.locator('link[rel="manifest"]');
      await expect(link).toHaveAttribute(
        "href",
        "/manifest.webmanifest?audience=staff",
      );
      const response = await request.get(
        "http://localhost:3100/manifest.webmanifest?audience=staff",
        {
          headers: { host: "test.localhost:3100" },
        },
      );
      expect(response.headers()["cache-control"]).toBe("no-store");
      expect(await response.json()).toMatchObject({
        id: "/management",
        start_url: "/management",
        scope: "/",
      });
      await expect(
        page.getByRole("button", { name: ja.PwaInstall.button, exact: true }),
      ).toHaveCount(mode === "browser" ? 1 : 0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      // A saved guest destination must not redirect the explicit staff start URL.
      await page.evaluate(() =>
        localStorage.setItem("tolo:pwa:last-page", "/event/test/guest"),
      );
      await page.goto("/management");
      await expect(page).toHaveURL("/management");

      for (const path of [
        "/management/members",
        "/event/test/management/graph/edit",
        "/event/test/management/guide-map/edit",
        "/event/test/observation",
        "/",
      ]) {
        await page.goto(path);
        await expect(page.locator("body")).toBeVisible();
        await expect(
          page.getByRole("button", { name: ja.PwaInstall.button, exact: true }),
        ).toHaveCount(0);
      }
    });

    test("disconnect closes a privileged dialog; reconnect requires a server reload", async ({
      page,
      context,
    }) => {
      await page.goto("/management/members");
      await page
        .getByRole("list", { name: "メンバー", exact: true })
        .getByRole("listitem")
        .filter({ hasText: "佐藤 花子" })
        .getByRole("button", { name: "イベントロール" })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await context.setOffline(true);
      await expect(
        page.getByRole("alert").filter({ hasText: ja.StaffConnection.title }),
      ).toContainText(ja.StaffConnection.offline);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByText("佐藤 花子")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: ja.StaffConnection.reload }),
      ).toBeDisabled();
      await context.setOffline(false);
      await expect(
        page.getByRole("alert").filter({ hasText: ja.StaffConnection.title }),
      ).toContainText(ja.StaffConnection.reconnected);
      await expect(page.getByText("佐藤 花子")).toHaveCount(0);
      await page
        .getByRole("button", { name: ja.StaffConnection.reload })
        .click();
      await expect(
        page.getByRole("list", { name: "メンバー", exact: true }),
      ).toContainText("佐藤 花子");
      await expect(
        page.getByRole("alert").filter({ hasText: ja.StaffConnection.title }),
      ).toHaveCount(0);
    });

    test("the field map hides old data and save actions while offline", async ({
      page,
      context,
    }) => {
      await page.goto("/event/test/management");
      await expect(page.getByTestId("rf__node-ph_booth")).toBeVisible();
      await expect(
        page.getByRole("link", { name: ja.Management.observationDevicesLink }),
      ).toBeInViewport();
      await context.setOffline(true);
      await expect(
        page.getByRole("alert").filter({ hasText: ja.StaffConnection.title }),
      ).toContainText(ja.StaffConnection.offline);
      await expect(page.getByTestId("rf__node-ph_booth")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "保存", exact: true }),
      ).toHaveCount(0);
      await context.setOffline(false);
      await expect(
        page.getByRole("alert").filter({ hasText: ja.StaffConnection.title }),
      ).toContainText(ja.StaffConnection.reconnected);
    });
  });
}

test("English offline instructions and browser back restoration do not expose protected data", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: "http://test.localhost:3100" },
  ]);
  await page.goto("/management");
  await expect(
    page.getByRole("button", { name: en.PwaInstall.button, exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await expect(
    page.getByRole("alert").filter({ hasText: en.StaffConnection.title }),
  ).toContainText(en.StaffConnection.reconnected);
  await page.getByRole("button", { name: en.StaffConnection.reload }).click();
  await context.setOffline(true);
  await expect(
    page.getByRole("alert").filter({ hasText: en.StaffConnection.title }),
  ).toContainText(en.StaffConnection.offline);
  await context.setOffline(false);
});

test("PWA code creates no offline caches; the only test worker is MSW", async ({
  page,
}) => {
  await page.goto("/event/test/management");
  await expect(page.getByTestId("rf__node-ph_booth")).toBeVisible();
  const storage = await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    // MSW stores active client IDs so they survive a worker restart.
    const mswClientCaches = new Set(
      registrations.flatMap(({ active, scope }) =>
        active && new URL(active.scriptURL).pathname === "/mockServiceWorker.js"
          ? [`msw:active-clients:${scope}`]
          : [],
      ),
    );
    return {
      caches: (await caches.keys()).filter(
        (name) => !mswClientCaches.has(name),
      ),
      workers: registrations.map(({ active }) => active?.scriptURL),
    };
  });
  expect(storage.caches).toEqual([]);
  expect(
    storage.workers.every(
      (worker) =>
        worker && new URL(worker).pathname === "/mockServiceWorker.js",
    ),
  ).toBe(true);
});

test("protected HTML is not reusable as an HTTP cached page", async ({
  request,
}) => {
  for (const path of [
    "/management",
    "/management/members",
    "/event/test/management",
    "/event/test/management/graph/edit",
    "/event/test/management/guide-map/edit",
    "/event/test/observation",
  ]) {
    const response = await request.get(`http://localhost:3100${path}`, {
      headers: { host: "test.localhost:3100" },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});

test("an API failure with a network connection is not mislabeled as offline", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "msw:overrides",
      JSON.stringify({ getGraphError: true }),
    ),
  );
  await page.goto("/event/test/management");
  await expect(
    page.getByText(ja.Graph.load.error, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: ja.StaffConnection.title }),
  ).toHaveCount(0);
});

test("camera page warns when offline while retaining the existing device launch URL", async ({
  page,
  context,
}) => {
  await page.goto("/event/test/observation/3b9d77f41e2a5c08");
  await expect(
    page.getByRole("heading", { name: "解除コードを設定" }),
  ).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    `/manifest.webmanifest?start=${encodeURIComponent("/event/test/observation/3b9d77f41e2a5c08")}`,
  );
  await context.setOffline(true);
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: ja.StaffConnection.cameraOffline }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "解除コードを設定" }),
  ).toBeVisible();
  await context.setOffline(false);
});

test("guide-map editing stops on disconnect and reloads after reconnect", async ({
  page,
  context,
}) => {
  await page.goto("/event/test/management/guide-map/edit");
  await expect(
    page.locator("header").getByRole("button", { name: /^保存(?!ポイント)/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: ja.PwaInstall.button, exact: true }),
  ).toHaveCount(0);
  await context.setOffline(true);
  await expect(
    page.getByRole("alert").filter({ hasText: ja.StaffConnection.title }),
  ).toContainText(ja.StaffConnection.offline);
  await expect(
    page.locator("header").getByRole("button", { name: /^保存(?!ポイント)/ }),
  ).toHaveCount(0);
  await context.setOffline(false);
  await expect(
    page.getByRole("alert").filter({ hasText: ja.StaffConnection.title }),
  ).toContainText(ja.StaffConnection.reconnected);
  await page.getByRole("button", { name: ja.StaffConnection.reload }).click();
  await expect(
    page.locator("header").getByRole("button", { name: /^保存(?!ポイント)/ }),
  ).toBeVisible();
});

test("camera records do not reveal another account's or unowned legacy data", async ({
  page,
}) => {
  const legacyKey = "tolo:observation-measurements:test:3b9d77f41e2a5c08";
  const otherKey = scopeStaffStorageKey(
    legacyKey,
    createStaffStorageScope("0123456789abcdef", {
      type: "staff",
      userId: "other-user",
    }),
  );
  await page.addInitScript(
    ({ legacyKey, otherKey }) => {
      const records = JSON.stringify([
        { observationPointName: "OTHER_ACCOUNT_ONLY", sent: false },
      ]);
      localStorage.setItem(legacyKey, records);
      localStorage.setItem(otherKey, records);
    },
    { legacyKey, otherKey },
  );
  await page.goto("/event/test/observation/3b9d77f41e2a5c08");
  await page
    .getByRole("textbox", { name: "解除コード", exact: true })
    .fill("1234");
  await page.getByRole("textbox", { name: "解除コード（確認）" }).fill("1234");
  await page.getByRole("button", { name: "設定して解除" }).click();
  await expect(page.getByText("端末の記録: 0 件（未送信 0 件）")).toBeVisible();
  await expect(page.getByText("OTHER_ACCOUNT_ONLY")).toHaveCount(0);
  const retained = await page.evaluate(
    ({ legacyKey, otherKey }) => [
      localStorage.getItem(legacyKey),
      localStorage.getItem(otherKey),
    ],
    { legacyKey, otherKey },
  );
  expect(retained.every((value) => value?.includes("OTHER_ACCOUNT_ONLY"))).toBe(
    true,
  );
});
