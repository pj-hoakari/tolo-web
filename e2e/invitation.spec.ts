import { expect, type Page, test } from "@playwright/test";
import type { MockRouterOverrides } from "@/mocks/router";

const token = "mock-invitation-token-1";
const invitationUrl = `/invitation?token=${token}`;

type MockOverrides = Pick<MockRouterOverrides, "acceptInvitationError">;

const openInvitation = async (page: Page, overrides?: MockOverrides) => {
  if (overrides) {
    await page.addInitScript((value) => {
      sessionStorage.setItem("msw:overrides", value);
    }, JSON.stringify(overrides));
  }
  await page.goto(invitationUrl);
  await expect(
    page.getByRole("heading", { level: 1, name: "テナントに参加" }),
  ).toBeVisible();
};

test("招待 URL を開くと、招待トークンをこのホストだけの HttpOnly の Cookie に移し、リファラーを送らない応答で招待トークンのない URL へ移る", async ({
  page,
  context,
}) => {
  const landing = await page.request.get(invitationUrl, { maxRedirects: 0 });
  expect(landing.status()).toBe(303);
  expect(landing.headers().location).toBe("/invitation/accept");
  expect(landing.headers()["referrer-policy"]).toBe("no-referrer");

  await page.goto(invitationUrl);

  await expect(page).toHaveURL("/invitation/accept");
  expect(await context.cookies()).toContainEqual(
    expect.objectContaining({
      name: "__Host-tolo.invitation",
      value: token,
      domain: "test.localhost",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }),
  );
  await expect(page.getByRole("main")).toContainText(
    "test.localhost:3100 のテナントに招待されています。スタッフとして参加しますか。",
  );
  await expect(page.getByRole("button", { name: "参加する" })).toBeVisible();
});

test("招待 URL を開かずに参加の画面を開くと、招待 URL を開き直すよう案内され参加のボタンは出ない", async ({
  page,
}) => {
  await page.goto("/invitation/accept");

  await expect(page.getByRole("main")).toContainText(
    "招待が見つかりません。受け取った招待 URL を開き直してください。",
  );
  await expect(page.getByRole("button", { name: "参加する" })).toHaveCount(0);
});

test("招待を受けて参加すると、同じテナントのホストの管理ページへ移る", async ({
  page,
}) => {
  await openInvitation(page);
  await page.getByRole("button", { name: "参加する" }).click();

  await expect(page).toHaveURL("/management");
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "0123456789abcdef イベント管理",
    }),
  ).toBeVisible();
});

test("使用済み・期限切れ・取り消し済みの招待で参加しようとすると、招待したオーナーに連絡するよう案内され参加のボタンは消える", async ({
  page,
}) => {
  await openInvitation(page, { acceptInvitationError: "UNAUTHORIZED" });
  await page.getByRole("button", { name: "参加する" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "この招待は使えません。使用済みか、期限が切れているか、取り消された可能性があります。招待したオーナーに連絡して、新しい招待 URL を受け取ってください。",
  );
  await expect(page.getByRole("button", { name: "参加する" })).toHaveCount(0);
});

test("すでにメンバーであるなどで参加できないときは、その旨と管理ページへのリンクが表示される", async ({
  page,
}) => {
  await openInvitation(page, { acceptInvitationError: "PRECONDITION_FAILED" });
  await page.getByRole("button", { name: "参加する" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "このテナントには参加できません。すでにメンバーであるか、テナントがアーカイブされている可能性があります。",
  );
  await expect(
    page.getByRole("link", { name: "管理ページを開く" }),
  ).toHaveAttribute("href", "/management");
});

test("それ以外の理由で参加できなかったときは、エラーが表示されもう一度試せる", async ({
  page,
}) => {
  await openInvitation(page, {
    acceptInvitationError: "INTERNAL_SERVER_ERROR",
  });
  await page.getByRole("button", { name: "参加する" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "テナントに参加できませんでした。もう一度試してください。",
  );
  await expect(page.getByRole("button", { name: "参加する" })).toBeEnabled();
});

test("ルートドメインで招待 URL を開くと 404 になる", async ({ page }) => {
  const response = await page.goto(`http://localhost:3100${invitationUrl}`);
  expect(response?.status()).toBe(404);
});
