import { expect, type Page, test } from "@playwright/test";

const samplePagePath = "/event/test/observation/8c1f0e2a5d4b3c6e";
const primaryCamera = "ESP32 カメラ";
const secondCamera = "ESP32 カメラ 2";

const cameraSelector = (page: Page) =>
  page.getByRole("button", { name: /カメラ$/ });
const startButton = (page: Page) =>
  page.getByRole("button", { name: "カメラを起動" });
const code = (page: Page) =>
  page.getByRole("textbox", { name: "解除コード", exact: true });
const confirmation = (page: Page) =>
  page.getByRole("textbox", { name: "解除コード（確認）" });

const setUpUnlockCode = async (page: Page, value: string) => {
  await code(page).fill(value);
  await confirmation(page).fill(value);
  await page.getByRole("button", { name: "設定して解除" }).click();
  await expect(page.getByRole("button", { name: "画面ロック" })).toBeVisible();
};

test.beforeEach(async ({ page, context }) => {
  await context.route("**/models/*.onnx", (route) =>
    route.fulfill({
      contentType: "application/octet-stream",
      body: "mock-model",
    }),
  );
  await page.goto(samplePagePath);
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "0123456789abcdef 観測ページ",
    }),
  ).toBeVisible();
  await setUpUnlockCode(page, "1234");
});

test("モックモードの2台のカメラを切り替えて合成映像を表示する", async ({
  page,
}, testInfo) => {
  const selector = cameraSelector(page);
  await expect(selector).toBeVisible();
  await selector.click();

  const options = page.getByRole("option");
  await expect(options).toHaveCount(2);
  await expect(options).toHaveText([primaryCamera, secondCamera]);
  await page.keyboard.press("Escape");
  await expect(selector).toContainText(primaryCamera);

  await startButton(page).click();
  await expect(page.getByText("検出状態: 検出中")).toBeVisible({
    timeout: 20_000,
  });

  const video = page.locator("main video").first();
  await expect
    .poll(() =>
      video.evaluate((element) => {
        const media = element as HTMLVideoElement;
        return {
          width: media.videoWidth,
          height: media.videoHeight,
        };
      }),
    )
    .toMatchObject({ width: 1280, height: 720 });

  const cameraStatus = page.getByRole("list");
  await expect(cameraStatus.getByRole("listitem")).toHaveCount(2);
  await expect(cameraStatus.getByRole("listitem").nth(0)).toContainText(
    `${primaryCamera}:`,
  );
  await expect(cameraStatus.getByRole("listitem").nth(1)).toContainText(
    `${secondCamera}:`,
  );

  await selector.click();
  await page.getByRole("option", { name: secondCamera }).click();
  await expect(selector).toHaveAccessibleName(`${secondCamera} カメラ`);
  await expect(cameraStatus.getByRole("listitem").nth(1)).toContainText(
    `${secondCamera}:`,
  );

  const screenshotPath = testInfo.outputPath("observation-multi-camera.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("observation-multi-camera", {
    path: screenshotPath,
    contentType: "image/png",
  });
});
