import { expect, test } from "@playwright/test";

test("テナントのページは起動時の環境変数 FIREBASE_PROJECT_ID の Firebase プロジェクトをブラウザへ渡す", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(await response?.text()).toContain("e2e-tolo-signaling");
});
