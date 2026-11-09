import { expect, type Page, test } from "@playwright/test";

const samplePagePath = "/event/test/observation/8c1f0e2a5d4b3c6e";
const primaryCamera = "ESP32 カメラ";
const secondCamera = "ESP32 カメラ 2";

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

const videoStreamId = (page: Page) =>
  page
    .locator("main video")
    .first()
    .evaluate((element) => {
      const stream = (element as HTMLVideoElement).srcObject;
      return stream instanceof MediaStream ? stream.id : null;
    });

const hasCapturingOrDetectingStatus = async (page: Page) => {
  const labels = await page.getByRole("tab").allTextContents();
  return labels.some((label) => /撮影中|検出中/.test(label));
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

test("モックモードの2台のカメラを自動接続しタブで切り替えて合成映像を表示する", async ({
  page,
}, testInfo) => {
  // ESP モードでは起動ボタンを出さず、ページ表示時に自動接続する。
  await expect(page.getByRole("button", { name: "カメラを起動" })).toHaveCount(
    0,
  );

  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(2, { timeout: 20_000 });
  await expect(tabs.nth(0)).toContainText(primaryCamera);
  await expect(tabs.nth(1)).toContainText(secondCamera);
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");

  // タブのラベルにカメラごとの撮影・検出状態が出る。
  await expect
    .poll(() => hasCapturingOrDetectingStatus(page), { timeout: 20_000 })
    .toBe(true);

  // ESP モードでは検出状態の行をタブへ移し、人数と FPS だけを残す。
  await expect(page.getByText(/検出状態:/)).toHaveCount(0);
  await expect(page.getByText(/追跡中人数:/)).toBeVisible();
  await expect(page.getByText(/FPS:/)).toBeVisible();

  const video = page.locator("main video").first();
  await expect
    .poll(
      () =>
        video.evaluate((element) => {
          const media = element as HTMLVideoElement;
          return {
            width: media.videoWidth,
            height: media.videoHeight,
          };
        }),
      { timeout: 20_000 },
    )
    .toMatchObject({ width: 1280, height: 720 });

  const firstStreamId = await videoStreamId(page);
  expect(firstStreamId).not.toBeNull();

  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "false");

  // 選択したタブの映像へ切り替わる。
  await expect
    .poll(
      async () => {
        const streamId = await videoStreamId(page);
        return streamId !== null && streamId !== firstStreamId;
      },
      { timeout: 10_000 },
    )
    .toBe(true);

  await expect
    .poll(() => hasCapturingOrDetectingStatus(page), { timeout: 20_000 })
    .toBe(true);

  const screenshotPath = testInfo.outputPath("observation-multi-camera.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("observation-multi-camera", {
    path: screenshotPath,
    contentType: "image/png",
  });
});
