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

test("AUTH_MOCKING では、ログインの開始と引き渡しの経路とルートドメインのログイン画面は 404 になる", async ({
  request,
}) => {
  for (const path of [
    "/auth/login?return=/management",
    "/auth/handoff?code=x",
    "http://localhost:3100/auth/begin?login=x",
    "http://localhost:3100/login?challenge=x",
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(404);
  }
});

test("ルートドメインのログイン画面は、ほかのサイトに埋め込ませない", async ({
  request,
}) => {
  const response = await request.get("http://localhost:3100/login?challenge=x");

  expect(response.headers()["content-security-policy"]).toBe(
    "frame-ancestors 'none'",
  );
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

test("ログインに失敗した画面から、ログインを始めたテナントのホストの管理ページへ戻れる", async ({
  page,
}) => {
  await page.goto(
    "http://localhost:3100/auth/error?host=test.localhost:3100&error=login_expired",
  );

  await expect(
    page.getByRole("heading", { level: 1, name: "ログインできませんでした" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "ログインし直す" }).click();

  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "0123456789abcdef イベント管理",
    }),
  ).toBeVisible();
  expect(page.url()).toBe("http://test.localhost:3100/management");
});

test("ログインに失敗した画面は、テナントのホストでない戻り先へのリンクを出さない", async ({
  page,
}) => {
  for (const host of [
    "evil.example",
    "test.localhost:3100@evil.example",
    "localhost:3100",
  ]) {
    await page.goto(
      `http://localhost:3100/auth/error?host=${encodeURIComponent(host)}`,
    );

    await expect(
      page.getByText(
        "利用していたテナントのページを開き直して、ログインし直してください。",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "ログインし直す" }),
    ).toHaveCount(0);
  }
});
