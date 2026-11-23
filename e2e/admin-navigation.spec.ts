import { expect, test } from "@playwright/test";

const eventId = "fedcba9876543210";
const edgeDeviceId = "8c1f0e2a5d4b3c6e";
const management = `/event/${eventId}/management`;
const devices = `/event/${eventId}/observation`;

for (const { name, viewport, locale, labels } of [
  {
    name: "desktop",
    viewport: { width: 1440, height: 900 },
    locale: "ja-JP",
    labels: {
      edit: "案内マップを編集",
      management: "管理ページへ戻る",
      devices: "観測デバイス管理へ戻る",
      code: "解除コード",
      confirmation: "解除コード（確認）",
      unlock: "設定して解除",
    },
  },
  {
    name: "mobile",
    viewport: { width: 390, height: 844 },
    locale: "en-US",
    labels: {
      edit: "Edit guide map",
      management: "Back to management",
      devices: "Back to observation devices",
      code: "Unlock code",
      confirmation: "Unlock code (confirmation)",
      unlock: "Set and unlock",
    },
  },
]) {
  test.describe(name, () => {
    test.use({
      viewport,
      locale,
      isMobile: name === "mobile",
      hasTouch: name === "mobile",
    });

    test("opens the same event's guide map and returns to management", async ({
      page,
    }) => {
      await page.goto(management);
      const editLink = page.getByRole("link", { name: labels.edit });
      await expect(editLink).toBeInViewport({ ratio: 1 });
      await editLink.click();
      await expect(page).toHaveURL(`${management}/guide-map/edit`);

      await page.getByRole("link", { name: labels.management }).click();
      await expect(page).toHaveURL(management);
    });

    test("returns from device observation to the same event's device list", async ({
      page,
    }) => {
      await page.goto(`${devices}/${edgeDeviceId}`);
      await page
        .getByRole("textbox", { name: labels.code, exact: true })
        .fill("1234");
      await page
        .getByRole("textbox", { name: labels.confirmation })
        .fill("1234");
      await page.getByRole("button", { name: labels.unlock }).click();

      const backLink = page.getByRole("link", { name: labels.devices });
      await expect(backLink).toBeInViewport({ ratio: 1 });
      await backLink.click();
      await expect(page).toHaveURL(devices);
    });
  });
}
