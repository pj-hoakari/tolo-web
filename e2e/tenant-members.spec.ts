import { expect, type Page, test } from "@playwright/test";
import type { MockRouterOverrides } from "@/mocks/router";

type MockOverrides = Pick<
  MockRouterOverrides,
  "members" | "listMembersError" | "createInvitationError"
>;

const memberList = (page: Page) =>
  page.getByRole("list", { name: "メンバー", exact: true });
const memberRow = (page: Page, name: string) =>
  memberList(page).getByRole("listitem").filter({ hasText: name });
const invitationList = (page: Page) =>
  page.getByRole("list", { name: "未使用の招待" });
const invitationRow = (page: Page, name: string) =>
  invitationList(page).getByRole("listitem").filter({ hasText: name });

const open = async (page: Page, overrides?: MockOverrides) => {
  if (overrides) {
    await page.addInitScript((value) => {
      sessionStorage.setItem("msw:overrides", value);
    }, JSON.stringify(overrides));
  }
  await page.goto("/management/members");
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "0123456789abcdef メンバー管理",
    }),
  ).toBeVisible();
};

test("イベント管理ページの「メンバー管理」からメンバー管理ページへ移り、「イベント管理」で戻れる", async ({
  page,
}) => {
  await page.goto("/management");
  await page.getByRole("link", { name: "メンバー管理" }).click();
  await expect(page).toHaveURL("/management/members");
  await expect(memberList(page)).toBeVisible();

  await page.getByRole("link", { name: "イベント管理" }).click();
  await expect(page).toHaveURL("/management");
});

test("メンバーが表示名・テナントロール・参加日時とともに一覧に表示される", async ({
  page,
}) => {
  await open(page);

  await expect(memberList(page).getByRole("listitem")).toHaveCount(2);
  await expect(memberRow(page, "山田 太郎")).toContainText("オーナー");
  await expect(memberRow(page, "山田 太郎")).toContainText(
    "参加: 2026/10/01 9:00",
  );
  await expect(memberRow(page, "佐藤 花子")).toContainText("スタッフ");
  await expect(memberRow(page, "佐藤 花子")).toContainText(
    "参加: 2026/10/29 10:30",
  );
});

test("招待はスタッフとしてだけ作る。表示名を入力して作成すると、テナントのホストと招待トークンだけからなる招待 URL が表示され、未使用の招待に加わる", async ({
  page,
}) => {
  await open(page);
  await expect(
    page.getByText(
      "招待した人は、この表示名のスタッフとして参加します。オーナーにするときは、参加した後にメンバーの一覧から変更します。",
    ),
  ).toBeVisible();
  const field = page.getByRole("textbox", { name: "招待する人の表示名" });
  await field.fill("高橋 次郎");
  await page.getByRole("button", { name: "招待 URL を作成" }).click();

  const url = page.getByRole("textbox", { name: "招待 URL" });
  await expect(url).toHaveValue(
    "http://test.localhost:3100/invitation?token=mock-invitation-token-2",
  );
  await expect(url).not.toHaveValue(/0123456789abcdef/);
  await expect(field).toHaveValue("");
  await expect(invitationRow(page, "高橋 次郎")).toBeVisible();
  await expect(invitationList(page).getByRole("listitem")).toHaveCount(2);
});

test("招待の作成に失敗すると、エラーが表示され入力は残る", async ({ page }) => {
  await open(page, { createInvitationError: "INTERNAL_SERVER_ERROR" });
  const field = page.getByRole("textbox", { name: "招待する人の表示名" });
  await field.fill("高橋 次郎");
  await page.getByRole("button", { name: "招待 URL を作成" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "招待を作成できませんでした。",
  );
  await expect(field).toHaveValue("高橋 次郎");
  await expect(page.getByRole("textbox", { name: "招待 URL" })).toHaveCount(0);
});

test("未使用の招待は表示名と期限とともに一覧に表示され、取り消すと一覧から消える", async ({
  page,
}) => {
  await open(page);
  await expect(invitationRow(page, "鈴木 一郎")).toContainText(
    "期限: 2026/11/05 10:00",
  );

  await invitationRow(page, "鈴木 一郎")
    .getByRole("button", { name: "取り消す" })
    .click();

  await expect(page.getByText("未使用の招待はありません。")).toBeVisible();
});

test("スタッフをオーナーにするときは、別の経路で本人に確かめるよう参加日時とともに促され、確定するとオーナーになる", async ({
  page,
}) => {
  await open(page);
  await memberRow(page, "佐藤 花子")
    .getByRole("button", { name: "オーナーにする" })
    .click();

  const dialog = page.getByRole("alertdialog", {
    name: "メンバーをオーナーにする",
  });
  await expect(dialog).toContainText(
    "表示名だけでは、招待した本人かどうかを確かめられません。オーナーにする前に、電話や対面など別の経路で本人に確かめてください。この人が参加した日時は 2026/10/29 10:30 です。",
  );
  await dialog.getByRole("button", { name: "オーナーにする" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(memberRow(page, "佐藤 花子")).toContainText("オーナー");
  await expect(
    memberRow(page, "佐藤 花子").getByRole("button", {
      name: "スタッフにする",
    }),
  ).toBeVisible();
});

test("オーナーにする確認はキーボードだけで開いて確定できる", async ({
  page,
}) => {
  await open(page);
  await memberRow(page, "佐藤 花子")
    .getByRole("button", { name: "オーナーにする" })
    .focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog", {
    name: "メンバーをオーナーにする",
  });
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "キャンセル" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "オーナーにする" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(dialog).toHaveCount(0);
  await expect(memberRow(page, "佐藤 花子")).toContainText("オーナー");
});

for (const { name, button, dialogName, confirm } of [
  {
    name: "ただ 1 人のオーナーをスタッフにしようとすると、オーナーが 1 人以上必要である旨のエラーが出てロールは変わらない",
    button: "スタッフにする",
    dialogName: "オーナーをスタッフにする",
    confirm: "スタッフにする",
  },
  {
    name: "ただ 1 人のオーナーを削除しようとすると、オーナーが 1 人以上必要である旨のエラーが出てメンバーは残る",
    button: "削除",
    dialogName: "メンバーを削除",
    confirm: "削除する",
  },
]) {
  test(name, async ({ page }) => {
    await open(page);
    await memberRow(page, "山田 太郎")
      .getByRole("button", { name: button, exact: true })
      .click();
    const dialog = page.getByRole("alertdialog", { name: dialogName });
    await dialog.getByRole("button", { name: confirm }).click();

    await expect(dialog.getByRole("alert")).toHaveText(
      "テナントには 1 人以上のオーナーが必要です。先にほかのメンバーをオーナーにしてください。",
    );
    await dialog.getByRole("button", { name: "キャンセル" }).click();
    await expect(memberRow(page, "山田 太郎")).toContainText("オーナー");
  });
}

test("オーナーが 2 人いれば、そのうち 1 人をスタッフにできる", async ({
  page,
}) => {
  await open(page, {
    members: [
      {
        userId: "user-owner",
        displayName: "山田 太郎",
        role: "owner",
        joinedAt: "2026-10-01T00:00:00.000Z",
        eventRoles: [],
      },
      {
        userId: "user-owner-2",
        displayName: "田中 三郎",
        role: "owner",
        joinedAt: "2026-10-02T00:00:00.000Z",
        eventRoles: [],
      },
    ],
  });
  await memberRow(page, "山田 太郎")
    .getByRole("button", { name: "スタッフにする" })
    .click();
  await page
    .getByRole("alertdialog", { name: "オーナーをスタッフにする" })
    .getByRole("button", { name: "スタッフにする" })
    .click();

  await expect(memberRow(page, "山田 太郎")).toContainText("スタッフ");
});

test("スタッフを確認のうえ削除すると一覧から消える", async ({ page }) => {
  await open(page);
  await memberRow(page, "佐藤 花子")
    .getByRole("button", { name: "削除", exact: true })
    .click();
  const dialog = page.getByRole("alertdialog", { name: "メンバーを削除" });
  await expect(dialog).toContainText(
    "「佐藤 花子」をこのテナントから削除します。",
  );
  await dialog.getByRole("button", { name: "削除する" }).click();

  await expect(memberRow(page, "佐藤 花子")).toHaveCount(0);
  await expect(memberList(page).getByRole("listitem")).toHaveCount(1);
});

test("メンバー一覧の取得に失敗するとエラーと再読み込みボタンが表示される", async ({
  page,
}) => {
  await open(page, { listMembersError: true });

  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert).toContainText("メンバーの一覧を取得できませんでした。");
  await expect(alert.getByRole("button", { name: "再読み込み" })).toBeVisible();
  await expect(memberList(page)).toHaveCount(0);
});
