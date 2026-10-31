import { expect, type Page, test } from "@playwright/test";
import type { MockRouterOverrides } from "@/mocks/router";

type MockOverrides = Pick<MockRouterOverrides, "grantEventRoleError">;

const memberRow = (page: Page, name: string) =>
  page
    .getByRole("list", { name: "メンバー", exact: true })
    .getByRole("listitem")
    .filter({ hasText: name });

const openEventRoles = async (
  page: Page,
  name: string,
  overrides?: MockOverrides,
) => {
  if (overrides) {
    await page.addInitScript((value) => {
      sessionStorage.setItem("msw:overrides", value);
    }, JSON.stringify(overrides));
  }
  await page.goto("/management/members");
  await memberRow(page, name)
    .getByRole("button", { name: "イベントロール" })
    .click();
  return page.getByRole("dialog", { name: `${name} のイベントロール` });
};

test("メンバーの一覧に、イベントロールを割り当てたイベントが表示される", async ({
  page,
}) => {
  await page.goto("/management/members");

  await expect(memberRow(page, "山田 太郎")).toContainText(
    "イベント: Event A、Event B",
  );
  await expect(memberRow(page, "佐藤 花子")).toContainText("イベント: なし");
});

test("イベントを選んで割り当てると、メンバーのテナントロールと同じイベントロールが付き、ロールとともに一覧に表示される", async ({
  page,
}) => {
  const dialog = await openEventRoles(page, "佐藤 花子");
  await expect(dialog).toContainText(
    "このメンバーがイベントのページを使えるのは、イベントロールを割り当てたイベントだけです。割り当てるイベントロールは、このメンバーのテナントロールと同じスタッフです。",
  );
  await expect(dialog).toContainText("割り当てたイベントはありません。");

  await dialog.getByRole("button", { name: /イベントを選ぶ/ }).click();
  await page.getByRole("option", { name: "Event C" }).click();
  await dialog.getByRole("button", { name: "割り当てる" }).click();

  await expect(
    dialog.getByRole("list", { name: "割り当てたイベント" }),
  ).toHaveText("Event Cスタッフ外す");
  await dialog.getByRole("button", { name: "閉じる" }).click();
  await expect(memberRow(page, "佐藤 花子")).toContainText("イベント: Event C");
});

test("割り当て済みのイベントとアーカイブ済みのイベントは、割り当てる候補に出ない", async ({
  page,
}) => {
  const dialog = await openEventRoles(page, "山田 太郎");
  await dialog.getByRole("button", { name: /イベントを選ぶ/ }).focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("option")).toHaveText(["Event C", "Event D"]);
});

test("割り当てたイベントを外すと、そのイベントは一覧から消える", async ({
  page,
}) => {
  const dialog = await openEventRoles(page, "山田 太郎");
  const assigned = dialog.getByRole("list", { name: "割り当てたイベント" });
  await assigned
    .getByRole("listitem")
    .filter({ hasText: "Event A" })
    .getByRole("button", { name: "外す" })
    .click();

  await expect(assigned.getByRole("listitem")).toHaveText([
    "Event Bオーナー外す",
  ]);
  await dialog.getByRole("button", { name: "閉じる" }).click();
  await expect(memberRow(page, "山田 太郎")).toContainText("イベント: Event B");
});

test("イベントロールを割り当てられないときは、イベントのアーカイブなどの可能性が表示される", async ({
  page,
}) => {
  const dialog = await openEventRoles(page, "佐藤 花子", {
    grantEventRoleError: "PRECONDITION_FAILED",
  });
  await dialog.getByRole("button", { name: /イベントを選ぶ/ }).click();
  await page.getByRole("option", { name: "Event D" }).click();
  await dialog.getByRole("button", { name: "割り当てる" }).click();

  await expect(dialog.getByRole("alert")).toHaveText(
    "このイベントには割り当てられません。イベントがアーカイブされたか、メンバーがテナントから外れた可能性があります。",
  );
  await expect(dialog).toContainText("割り当てたイベントはありません。");
});
