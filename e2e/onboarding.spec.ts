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
  await page.getByRole("textbox", { name: "オーナーの表示名" }).fill("山田");
  await page.getByRole("button", { name: "作成" }).click();
};

test("ルートドメインのトップで「テナントを作成」を押すとオンボーディングページへ移る", async ({
  page,
}) => {
  await page.goto(`${rootURL}/`);
  await page.getByRole("link", { name: "テナントを作成" }).click();

  await expect(page).toHaveURL(`${rootURL}/onboarding`);
  await expect(
    page.getByRole("heading", { level: 1, name: "テナントを作成" }),
  ).toBeVisible();
});

test("フォームはテナント名・サブドメイン名・オーナーの表示名だけを受け取り、オーナーのアカウントは聞かない", async ({
  page,
}) => {
  await open(page);

  await expect(page.getByRole("main").getByRole("textbox")).toHaveCount(3);
  await expect(
    page.getByRole("textbox", { name: "オーナーのメールアドレス" }),
  ).toHaveCount(0);
});

test("AUTH_MOCKING では、入力して作成すると完了表示とそのサブドメインのテナントページへのリンクが出る", async ({
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

test("オーナーの表示名が空白だけのときは作成できない", async ({ page }) => {
  await open(page);
  await page.getByRole("textbox", { name: "テナント名" }).fill("Acme");
  await page.getByRole("textbox", { name: "サブドメイン名" }).fill("acme");
  await page.getByRole("textbox", { name: "オーナーの表示名" }).fill("  ");

  await expect(page.getByRole("button", { name: "作成" })).toBeDisabled();
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

test("入力が規則に合わないときは、サブドメイン名と表示名の規則を示すエラーが表示される", async ({
  page,
}) => {
  await open(page, { registerTenantError: "BAD_REQUEST" });
  await fillAndSubmit(page);

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "入力内容が規則に合いません。サブドメイン名は英小文字・数字・ハイフンで 63 文字以内とし、先頭と末尾にハイフンは使えません。表示名は 64 文字以内です。",
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

test("所有権の取得に失敗して戻ってきたときは、その理由のエラーが表示され、入力し直して送れる", async ({
  page,
}) => {
  await page.goto(`${rootURL}/onboarding?error=subdomainTaken`);

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "このサブドメイン名は既に使われています。別の名前を指定してください。",
  );
  await expect(
    page.getByRole("textbox", { name: "サブドメイン名" }),
  ).toBeEnabled();
});

test("戻り先に知らないエラーが付いていても、エラーは表示しない", async ({
  page,
}) => {
  await page.goto(`${rootURL}/onboarding?error=%3Cscript%3E`);

  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
});

test("テナントのホストでオンボーディングページを開くと 404 になる", async ({
  page,
}) => {
  const response = await page.goto("/onboarding");
  expect(response?.status()).toBe(404);
});
