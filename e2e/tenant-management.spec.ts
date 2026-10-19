import { expect, type Page, test } from "@playwright/test";
import { MOCK_SERVER_MESSAGE, type MockRouterOverrides } from "@/mocks/router";

const eventList = (page: Page) => page.getByRole("main").getByRole("list");
const eventRow = (page: Page, name: string) =>
  eventList(page).getByRole("listitem").filter({ hasText: name });
const archiveButton = (page: Page, name: string) =>
  eventRow(page, name).getByRole("button", { name: "アーカイブ" });
const restoreButton = (page: Page, name: string) =>
  eventRow(page, name).getByRole("button", { name: "復元" });
const showArchived = (page: Page) =>
  page.getByRole("checkbox", { name: "アーカイブ済みも表示" });
const checkShowArchived = async (page: Page) => {
  await page
    .getByRole("main")
    .getByText("アーカイブ済みも表示", { exact: true })
    .click();
  await expect(showArchived(page)).toBeChecked();
};

type MockOverrides = Pick<
  MockRouterOverrides,
  | "listEventsError"
  | "createEventError"
  | "archiveEventError"
  | "restoreEventError"
>;

const open = async (page: Page, overrides?: MockOverrides) => {
  if (overrides) {
    await page.addInitScript((value) => {
      sessionStorage.setItem("msw:overrides", value);
    }, JSON.stringify(overrides));
  }
  await page.goto("/management");
  await expect(
    page.getByRole("heading", { level: 2, name: "test イベント管理" }),
  ).toBeVisible();
};

test("テナントのイベントが状態とともに一覧に表示される", async ({ page }) => {
  await open(page);
  await expect(eventList(page).getByRole("listitem")).toHaveCount(4);
  await expect(eventRow(page, "Event A")).toContainText("下書き");
  await expect(eventRow(page, "Event B")).toContainText("公開中");
  await expect(eventRow(page, "Event C")).toContainText("ロック中");
  await expect(eventRow(page, "Event D")).toContainText("終了");
  await expect(
    eventRow(page, "Event A").getByRole("link", { name: "Event A" }),
  ).toHaveAttribute("href", "/event/0000000000000001/management");
});

test("イベント名を入力して作成すると一覧に下書きとして追加され入力欄が空になる", async ({
  page,
}) => {
  await open(page);
  const field = page.getByRole("textbox", { name: "イベント名" });
  await field.fill("Event F");
  await page.getByRole("button", { name: "作成" }).click();

  await expect(eventRow(page, "Event F")).toContainText("下書き");
  await expect(eventList(page).getByRole("listitem")).toHaveCount(5);
  await expect(field).toHaveValue("");
});

test("下書きのイベントをダイアログで確認してアーカイブすると一覧から消える", async ({
  page,
}) => {
  await open(page);
  await archiveButton(page, "Event A").click();
  const dialog = page.getByRole("alertdialog", {
    name: "イベントをアーカイブ",
  });
  await expect(dialog).toContainText("「Event A」をアーカイブします。");

  await dialog.getByRole("button", { name: "アーカイブする" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(eventRow(page, "Event A")).toHaveCount(0);
  await expect(eventList(page).getByRole("listitem")).toHaveCount(3);
});

test("アーカイブのダイアログをキャンセルするとイベントは一覧に残る", async ({
  page,
}) => {
  await open(page);
  await archiveButton(page, "Event D").click();
  await page.getByRole("button", { name: "キャンセル" }).click();

  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(eventRow(page, "Event D")).toBeVisible();
});

test("公開中とロック中のイベントにはアーカイブボタンが表示されない", async ({
  page,
}) => {
  await open(page);
  await expect(eventRow(page, "Event B")).toBeVisible();
  await expect(archiveButton(page, "Event B")).toHaveCount(0);
  await expect(archiveButton(page, "Event C")).toHaveCount(0);
  await expect(archiveButton(page, "Event D")).toBeVisible();
});

test("イベント一覧の取得に失敗するとエラーと再読み込みボタンが表示される", async ({
  page,
}) => {
  await open(page, { listEventsError: true });

  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert).toContainText("イベント一覧を取得できませんでした。");
  await expect(alert.getByRole("button", { name: "再読み込み" })).toBeVisible();
  await expect(eventList(page)).toHaveCount(0);
});

for (const { name, code, message } of [
  {
    name: "テナントの状態によりイベントを作成できないと、テナントがアーカイブされている可能性が表示され入力は残る",
    code: "PRECONDITION_FAILED",
    message:
      "このテナントではイベントを作成できません。テナントがアーカイブされている可能性があります。",
  },
  {
    name: "テナントが見つからずイベントを作成できないと、その旨が表示され入力は残る",
    code: "NOT_FOUND",
    message: "テナントが見つかりませんでした。",
  },
  {
    name: "入力の拒否などそれ以外の理由でイベントの作成に失敗すると、作成できなかった旨が表示され入力は残る",
    code: "BAD_REQUEST",
    message: "イベントを作成できませんでした。",
  },
] as const) {
  test(name, async ({ page }) => {
    await open(page, { createEventError: code });

    const field = page.getByRole("textbox", { name: "イベント名" });
    await field.fill("Event F");
    await page.getByRole("button", { name: "作成" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toHaveText(message);
    await expect(page.getByText(MOCK_SERVER_MESSAGE)).toHaveCount(0);
    await expect(field).toHaveValue("Event F");
    await expect(eventRow(page, "Event F")).toHaveCount(0);
  });
}

for (const { name, code, message } of [
  {
    name: "イベントかテナントの状態が変わりアーカイブできないと、ダイアログに再読み込みを促す文言が表示され一覧に残る",
    code: "PRECONDITION_FAILED",
    message:
      "イベントまたはテナントの状態が変わったため、操作できませんでした。一覧を再読み込みしてください。",
  },
  {
    name: "イベントが見つからずアーカイブできないと、ダイアログにその旨が表示され一覧に残る",
    code: "NOT_FOUND",
    message: "イベントが見つかりませんでした。一覧を再読み込みしてください。",
  },
  {
    name: "それ以外の理由でアーカイブに失敗すると、ダイアログにアーカイブできなかった旨が表示され一覧に残る",
    code: "INTERNAL_SERVER_ERROR",
    message: "イベントをアーカイブできませんでした。",
  },
] as const) {
  test(name, async ({ page }) => {
    await open(page, { archiveEventError: code });

    await archiveButton(page, "Event A").click();
    const dialog = page.getByRole("alertdialog", {
      name: "イベントをアーカイブ",
    });
    await dialog.getByRole("button", { name: "アーカイブする" }).click();

    await expect(dialog.getByRole("alert")).toHaveText(message);
    await expect(page.getByText(MOCK_SERVER_MESSAGE)).toHaveCount(0);
    await dialog.getByRole("button", { name: "キャンセル" }).click();
    await expect(eventRow(page, "Event A")).toBeVisible();
  });
}

test("アーカイブ済みのイベントは既定では一覧に表示されない", async ({
  page,
}) => {
  await open(page);
  await expect(showArchived(page)).not.toBeChecked();
  await expect(eventList(page).getByRole("listitem")).toHaveCount(4);
  await expect(eventRow(page, "Event E")).toHaveCount(0);
});

test("アーカイブ済みも表示にすると復元ボタン付きでアーカイブ済みのイベントが表示される", async ({
  page,
}) => {
  await open(page);
  await checkShowArchived(page);

  await expect(eventList(page).getByRole("listitem")).toHaveCount(5);
  await expect(eventRow(page, "Event E")).toContainText("アーカイブ済み");
  await expect(restoreButton(page, "Event E")).toBeVisible();
  await expect(archiveButton(page, "Event E")).toHaveCount(0);
  await expect(restoreButton(page, "Event D")).toHaveCount(0);
});

test("アーカイブ済みのイベントを復元すると終了に戻りアーカイブできるようになる", async ({
  page,
}) => {
  await open(page);
  await checkShowArchived(page);
  await restoreButton(page, "Event E").click();

  await expect(eventRow(page, "Event E")).toContainText("終了");
  await expect(archiveButton(page, "Event E")).toBeVisible();
  await expect(restoreButton(page, "Event E")).toHaveCount(0);
});

test("アーカイブ済みも表示のままアーカイブするとアーカイブ済みとして一覧に残る", async ({
  page,
}) => {
  await open(page);
  await checkShowArchived(page);
  await archiveButton(page, "Event A").click();
  await page
    .getByRole("alertdialog", { name: "イベントをアーカイブ" })
    .getByRole("button", { name: "アーカイブする" })
    .click();

  await expect(eventRow(page, "Event A")).toContainText("アーカイブ済み");
  await expect(restoreButton(page, "Event A")).toBeVisible();
  await expect(eventList(page).getByRole("listitem")).toHaveCount(5);
});

for (const { name, code, message } of [
  {
    name: "イベントかテナントの状態が変わり復元できないと、行に再読み込みを促す文言が表示されアーカイブ済みのまま残る",
    code: "PRECONDITION_FAILED",
    message:
      "イベントまたはテナントの状態が変わったため、操作できませんでした。一覧を再読み込みしてください。",
  },
  {
    name: "イベントが見つからず復元できないと、行にその旨が表示されアーカイブ済みのまま残る",
    code: "NOT_FOUND",
    message: "イベントが見つかりませんでした。一覧を再読み込みしてください。",
  },
  {
    name: "それ以外の理由で復元に失敗すると、行に復元できなかった旨が表示されアーカイブ済みのまま残る",
    code: "INTERNAL_SERVER_ERROR",
    message: "イベントを復元できませんでした。",
  },
] as const) {
  test(name, async ({ page }) => {
    await open(page, { restoreEventError: code });
    await checkShowArchived(page);
    await restoreButton(page, "Event E").click();

    await expect(eventRow(page, "Event E").getByRole("alert")).toHaveText(
      message,
    );
    await expect(page.getByText(MOCK_SERVER_MESSAGE)).toHaveCount(0);
    await expect(eventRow(page, "Event E")).toContainText("アーカイブ済み");
    await expect(restoreButton(page, "Event E")).toBeEnabled();
  });
}
