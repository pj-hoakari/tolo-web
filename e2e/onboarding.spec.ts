import { expect, type Page, test } from "@playwright/test";
import type { MockRouterOverrides } from "@/mocks/router";

const rootURL = "http://localhost:3100";

type MockOverrides = Pick<MockRouterOverrides, "registerTenantError">;

const open = async (page: Page, overrides?: MockOverrides) => {
  if (overrides) {
    await page.addInitScript((value) => {
      sessionStorage.setItem("msw:overrides", value);
    }, JSON.stringify(overrides));
  }
  await page.goto(`${rootURL}/onboarding`);
  await expect(
    page.getByRole("heading", { level: 1, name: "テナントを作成" }),
  ).toBeVisible();
};

const fillAndSubmit = async (page: Page) => {
  await page.getByRole("textbox", { name: "テナント名" }).fill("Acme");
  await page.getByRole("textbox", { name: "サブドメイン名" }).fill("acme");
  await page
    .getByRole("textbox", { name: "オーナーのメールアドレス" })
    .fill("owner@example.com");
  await page.getByRole("button", { name: "作成" }).click();
};

test("テナント名・サブドメイン名・オーナーのメールアドレスを入力して作成すると、完了表示とそのサブドメインのテナントページへのリンクが出る", async ({
  page,
}) => {
  await open(page);
  await fillAndSubmit(page);

  await expect(
    page.getByRole("heading", { name: "テナントを作成しました" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "テナントのページを開く" }),
  ).toHaveAttribute("href", "http://acme.localhost:3100/");
  await expect(page.getByRole("button", { name: "作成" })).toHaveCount(0);
});

test("サブドメイン名が使用済みのときは、その旨のエラーが表示されフォームが残る", async ({
  page,
}) => {
  await open(page, { registerTenantError: "CONFLICT" });
  await fillAndSubmit(page);

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "このサブドメイン名は既に使われています。別の名前を指定してください。",
  );
  await expect(
    page.getByRole("textbox", { name: "サブドメイン名" }),
  ).toHaveValue("acme");
  await expect(page.getByRole("button", { name: "作成" })).toBeEnabled();
});

test("入力が規則に合わないときは、サブドメイン名の規則を示すエラーが表示される", async ({
  page,
}) => {
  await open(page, { registerTenantError: "BAD_REQUEST" });
  await fillAndSubmit(page);

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "入力内容が規則に合いません。サブドメイン名は英小文字・数字・ハイフンで 63 文字以内とし、先頭と末尾にハイフンは使えません。",
  );
});

test("それ以外の理由で失敗したときは、作成できなかった旨のエラーが表示される", async ({
  page,
}) => {
  await open(page, { registerTenantError: "INTERNAL_SERVER_ERROR" });
  await fillAndSubmit(page);

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "テナントを作成できませんでした。",
  );
});

test("テナントのホストでオンボーディングページを開くと 404 になる", async ({
  page,
}) => {
  const response = await page.goto("/onboarding");
  expect(response?.status()).toBe(404);
});
