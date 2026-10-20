import { expect, test } from "@playwright/test";

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
  await expect(page.getByRole("main")).toContainText("エッジ（3）");
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
