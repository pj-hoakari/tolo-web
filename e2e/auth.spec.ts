import { expect, test } from "@playwright/test";

test("AUTH_MOCKING では、管理ページはログインなしでモックのスタッフとして開ける", async ({
  page,
}) => {
  await page.goto("/management");

  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "0123456789abcdef イベント管理",
    }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/management");
});

test("AUTH_MOCKING では、ログインの開始と引き渡しの経路は 404 になる", async ({
  request,
}) => {
  for (const path of [
    "/auth/login?return=/management",
    "/auth/handoff?code=x",
    "http://localhost:3100/auth/begin?login=x",
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(404);
  }
});

test("/rpc は、CSRF 対策の独自ヘッダのない要求を 403 で拒否する", async ({
  request,
}) => {
  const call = (headers: Record<string, string>) =>
    request.post("/rpc/guest/openGuestPage", {
      headers: { "content-type": "application/json", ...headers },
      data: { json: {} },
    });

  expect((await call({})).status()).toBe(403);
  expect((await call({ "x-csrf-token": "orpc" })).status()).toBe(400);
});
