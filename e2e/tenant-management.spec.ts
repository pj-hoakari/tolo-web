import { expect, type Page, test } from "@playwright/test";
import { MOCK_SERVER_MESSAGE, type MockRouterOverrides } from "@/mocks/router";

const eventList = (page: Page) => page.getByRole("main").getByRole("list");
const eventRow = (page: Page, name: string) =>
  eventList(page).getByRole("listitem").filter({ hasText: name });
const eventActions = (page: Page, name: string) =>
  eventRow(page, name).getByRole("button", {
    name: `「${name}」のその他の操作`,
  });
const openArchiveDialog = async (page: Page, name: string) => {
  await eventActions(page, name).click();
  await page.getByRole("menuitem", { name: "アーカイブ", exact: true }).click();
};
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
  | "transitionEventStatusError"
>;

const open = async (page: Page, overrides?: MockOverrides) => {
  if (overrides) {
    await page.addInitScript((value) => {
      sessionStorage.setItem("msw:overrides", value);
    }, JSON.stringify(overrides));
  }
  await page.goto("/management");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "イベント管理",
    }),
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
    eventRow(page, "Event A").getByRole("link", {
      name: "Event A",
      exact: true,
    }),
  ).toHaveAttribute("href", "/event/0000000000000001/management");
});

test("作成ダイアログからイベントを作成すると一覧に追加され、次回は空の入力欄で開く", async ({
  page,
}) => {
  await open(page);
  await expect(page.getByRole("textbox", { name: "イベント名" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "イベントを作成" }).click();
  const field = page.getByRole("textbox", { name: "イベント名" });
  await field.fill("Event F");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "作成", exact: true })
    .click();

  await expect(eventRow(page, "Event F")).toContainText("下書き");
  await expect(eventList(page).getByRole("listitem")).toHaveCount(5);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "イベントを作成しました。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "イベントを作成" }).click();
  await expect(field).toHaveValue("");
});

test("イベントを作成すると、イベント種別が未設定である旨と、そのイベントの種別を設定するページへのリンクが表示される", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "イベントを作成" }).click();
  await page.getByRole("textbox", { name: "イベント名" }).fill("Event F");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "作成", exact: true })
    .click();

  const status = page
    .getByRole("main")
    .getByRole("status")
    .filter({ hasText: "イベント種別はまだ設定されていません。" });
  await expect(status).toContainText(
    "「Event F」を作成しました。イベント種別はまだ設定されていません。",
  );
  await expect(
    status.getByRole("link", { name: "イベント種別を設定する" }),
  ).toHaveAttribute("href", "/event/0000000000000006/management");
});

test("イベント一覧の操作から個別管理画面を開ける", async ({ page }) => {
  await open(page);
  await eventRow(page, "Event B")
    .getByRole("link", { name: "「Event B」を管理" })
    .click();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "0123456789abcdef 管理ページ",
    }),
  ).toBeVisible();
  await expect(page).toHaveURL("/event/0000000000000002/management");
});

test("イベントIDをコピーしても管理画面には遷移せず、先頭のゼロも保持する", async ({
  page,
  context,
}) => {
  await open(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin,
  });
  await eventRow(page, "Event A")
    .getByRole("button", { name: "「Event A」のイベントIDをコピー" })
    .click();
  await expect(eventRow(page, "Event A").getByRole("status")).toHaveText(
    "「Event A」のイベントIDをコピーしました。",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "0000000000000001",
  );
  await expect(page).toHaveURL("/management");
});

test("PCでは絞り込みを一列に表示し、全行の管理画面リンクの位置を揃える", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const search = await page
    .getByRole("searchbox", { name: "イベント名・IDで検索" })
    .boundingBox();
  const archived = await showArchived(page).boundingBox();
  if (!search || !archived) throw new Error("filters are not visible");
  const checkboxCenter = archived.y + archived.height / 2;
  expect(checkboxCenter).toBeGreaterThanOrEqual(search.y);
  expect(checkboxCenter).toBeLessThanOrEqual(search.y + search.height);
  const links = await Promise.all(
    ["Event A", "Event B", "Event C", "Event D"].map((name) =>
      eventRow(page, name)
        .getByRole("link", { name: `「${name}」を管理` })
        .boundingBox(),
    ),
  );
  for (const link of links) {
    if (!link || !links[0]) throw new Error("event link is not visible");
    expect(link.x).toBeCloseTo(links[0].x, 0);
    expect(link.width).toBeCloseTo(links[0].width, 0);
  }
  const firstRow = await eventRow(page, "Event A").boundingBox();
  if (!firstRow) throw new Error("event row is not visible");
  expect(firstRow.height).toBeGreaterThanOrEqual(60);
  expect(firstRow.height).toBeLessThanOrEqual(68);
  await expect(
    page.getByRole("searchbox", { name: "イベント名・IDで検索" }),
  ).toHaveAttribute("placeholder", "イベント名・IDで検索");
});

test("キーボードでその他の操作からアーカイブ確認を開き、閉じると操作ボタンに戻る", async ({
  page,
}) => {
  await open(page);
  const trigger = eventActions(page, "Event A");
  await trigger.focus();
  await trigger.press("Enter");
  await page
    .getByRole("menuitem", { name: "アーカイブ", exact: true })
    .press("Enter");
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "キャンセル" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("イベント作成をキャンセルすると一覧を変更せず、作成ボタンにフォーカスが戻る", async ({
  page,
}) => {
  await open(page);
  const trigger = page.getByRole("button", { name: "イベントを作成" });
  await trigger.click();
  await page
    .getByRole("textbox", { name: "イベント名" })
    .fill("Cancelled event");
  await page.getByRole("button", { name: "キャンセル" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(eventList(page).getByRole("listitem")).toHaveCount(4);
});

test("狭い画面でもイベント一覧と作成操作を利用できる", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await open(page);
  await expect(
    page.getByRole("button", { name: "言語を切り替え" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "テーマを切り替え" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await expect(eventRow(page, "Event B")).toBeVisible();
  await page.getByRole("button", { name: "イベントを作成" }).click();
  await expect(page.getByRole("textbox", { name: "イベント名" })).toBeVisible();
  await page.getByRole("button", { name: "キャンセル" }).click();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("イベント名・IDの検索と状態を組み合わせ、該当なしから条件をリセットできる", async ({
  page,
}) => {
  await open(page);
  await expect(page.getByText("4件", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("status")).toHaveText("4件");
  const search = page.getByRole("searchbox", { name: "イベント名・IDで検索" });
  await search.fill("  ｅｖｅｎｔ  ");
  await expect(eventList(page).getByRole("listitem")).toHaveCount(4);
  await page.getByRole("button", { name: /すべての状態/ }).click();
  await page.getByRole("option", { name: "公開中", exact: true }).click();
  await expect(eventList(page).getByRole("listitem")).toHaveCount(1);
  await expect(eventRow(page, "Event B")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("4件中1件を表示");
  await search.fill("0000000000000002");
  await expect(eventRow(page, "Event B")).toBeVisible();
  await search.fill("Event A");
  await expect(
    page.getByText("条件に一致するイベントがありません。", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("4件中0件を表示");
  await page.getByRole("button", { name: "条件をリセット" }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByRole("status")).toHaveText("4件");
  await expect(eventList(page).getByRole("listitem")).toHaveCount(4);
});

test("アーカイブ済みを状態で選ぶと取得対象に含まれ、表示をオフにすると状態もリセットされる", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: /すべての状態/ }).click();
  await page
    .getByRole("option", { name: "アーカイブ済み", exact: true })
    .click();
  await expect(showArchived(page)).toBeChecked();
  await expect(eventList(page).getByRole("listitem")).toHaveCount(1);
  await expect(eventRow(page, "Event E")).toBeVisible();
  await page.getByText("アーカイブ済みも表示", { exact: true }).click();
  await expect(showArchived(page)).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: /すべての状態/ }),
  ).toBeVisible();
  await expect(eventList(page).getByRole("listitem")).toHaveCount(4);
});

test("検索中に新規作成しても、新しいイベントが一覧に表示される", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("searchbox", { name: "イベント名・IDで検索" })
    .fill("Event B");
  await page.getByRole("button", { name: "イベントを作成" }).click();
  await page.getByRole("textbox", { name: "イベント名" }).fill("New event");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "作成", exact: true })
    .click();
  await expect(eventRow(page, "New event")).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "イベント名・IDで検索" }),
  ).toHaveValue("");
});

test("下書きのイベントをダイアログで確認してアーカイブすると一覧から消える", async ({
  page,
}) => {
  await open(page);
  await openArchiveDialog(page, "Event A");
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
  await openArchiveDialog(page, "Event D");
  await page.getByRole("button", { name: "キャンセル" }).click();

  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(eventRow(page, "Event D")).toBeVisible();
});

test("公開中とロック中のイベントにはアーカイブメニューが表示されない", async ({
  page,
}) => {
  await open(page);
  await expect(eventRow(page, "Event B")).toBeVisible();
  await expect(eventActions(page, "Event B")).toHaveCount(0);
  await expect(eventActions(page, "Event C")).toHaveCount(0);
  await expect(eventActions(page, "Event D")).toBeVisible();
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

    await page.getByRole("button", { name: "イベントを作成" }).click();

    const field = page.getByRole("textbox", { name: "イベント名" });
    await field.fill("Event F");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "作成", exact: true })
      .click();

    await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
      message,
    );
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

    await openArchiveDialog(page, "Event A");
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
  await expect(eventActions(page, "Event E")).toHaveCount(0);
  await expect(restoreButton(page, "Event D")).toHaveCount(0);
});

test("アーカイブ済みのイベントを復元すると終了に戻りアーカイブできるようになる", async ({
  page,
}) => {
  await open(page);
  await checkShowArchived(page);
  await restoreButton(page, "Event E").click();

  await expect(eventRow(page, "Event E")).toContainText("終了");
  await expect(eventActions(page, "Event E")).toBeVisible();
  await expect(restoreButton(page, "Event E")).toHaveCount(0);
});

test("アーカイブ済みも表示のままアーカイブするとアーカイブ済みとして一覧に残る", async ({
  page,
}) => {
  await open(page);
  await checkShowArchived(page);
  await openArchiveDialog(page, "Event A");
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

const statusTrigger = (page: Page, name: string) =>
  eventRow(page, name).getByRole("button", {
    name: new RegExp(`「${name}」の状態を変更`),
  });
const statusDialog = (page: Page) =>
  page.getByRole("dialog", { name: "イベントの状態を変更" });
const chooseStatus = async (page: Page, name: string, target: string) => {
  await statusTrigger(page, name).click();
  await page.getByRole("menuitem", { name: target, exact: true }).click();
};

for (const { name, from, targets, to } of [
  {
    name: "Event A",
    from: "下書き",
    targets: ["公開中", "アーカイブ済み"],
    to: "公開中",
  },
  {
    name: "Event A",
    from: "下書き",
    targets: ["公開中", "アーカイブ済み"],
    to: "アーカイブ済み",
  },
  { name: "Event B", from: "公開中", targets: ["ロック中"], to: "ロック中" },
  {
    name: "Event C",
    from: "ロック中",
    targets: ["公開中", "終了"],
    to: "公開中",
  },
  {
    name: "Event C",
    from: "ロック中",
    targets: ["公開中", "終了"],
    to: "終了",
  },
  {
    name: "Event D",
    from: "終了",
    targets: ["公開中", "アーカイブ済み"],
    to: "公開中",
  },
  {
    name: "Event D",
    from: "終了",
    targets: ["公開中", "アーカイブ済み"],
    to: "アーカイブ済み",
  },
  { name: "Event E", from: "アーカイブ済み", targets: ["終了"], to: "終了" },
]) {
  test(`状態ボタンから ${from} → ${to} に変更できる`, async ({ page }) => {
    await open(page);
    if (name === "Event E") await checkShowArchived(page);
    await statusTrigger(page, name).click();
    await expect(page.getByRole("menu").getByRole("menuitem")).toHaveText([
      "下書き",
      ...targets,
    ]);
    await expect(
      page.getByRole("menuitem", { name: "下書き", exact: true }),
    ).toBeDisabled();
    await page.getByRole("menuitem", { name: to, exact: true }).click();
    await expect(statusDialog(page)).toContainText(`「${from}」から「${to}」`);
    await statusDialog(page)
      .getByRole("button", { name: "変更する", exact: true })
      .click();
    await expect(statusDialog(page)).toHaveCount(0);
    await expect(
      page.getByRole("status").filter({
        hasText: `「${name}」の状態を「${to}」に変更しました。`,
      }),
    ).toBeVisible();
    if (to === "アーカイブ済み")
      await expect(eventRow(page, name)).toHaveCount(0);
    else
      await expect(statusTrigger(page, name)).toHaveAccessibleName(
        `「${name}」の状態を変更（${to}）`,
      );
  });
}

test("状態変更をキャンセルすると状態は変わらず、状態ボタンにフォーカスが戻る", async ({
  page,
}) => {
  await open(page);
  await statusTrigger(page, "Event A").focus();
  await statusTrigger(page, "Event A").press("Enter");
  await page
    .getByRole("menuitem", { name: "公開中", exact: true })
    .press("Enter");
  await statusDialog(page)
    .getByRole("button", { name: "キャンセル", exact: true })
    .click();
  await expect(statusDialog(page)).toHaveCount(0);
  await expect(statusTrigger(page, "Event A")).toBeFocused();
  await expect(statusTrigger(page, "Event A")).toHaveAccessibleName(
    "「Event A」の状態を変更（下書き）",
  );
});

test("状態を変更すると現在の絞り込み条件と件数に反映される", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: /すべての状態/ }).click();
  await page.getByRole("option", { name: "公開中", exact: true }).click();
  await chooseStatus(page, "Event B", "ロック中");
  await statusDialog(page)
    .getByRole("button", { name: "変更する", exact: true })
    .click();
  await expect(eventRow(page, "Event B")).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "4件中0件を表示" }),
  ).toBeVisible();
});

for (const { code, message } of [
  {
    code: "PRECONDITION_FAILED",
    message:
      "イベントまたはテナントの状態が変わったため、操作できませんでした。一覧を再読み込みしてください。",
  },
  {
    code: "NOT_FOUND",
    message: "イベントが見つかりませんでした。一覧を再読み込みしてください。",
  },
  { code: "FORBIDDEN", message: "イベントの状態を変更できませんでした。" },
  {
    code: "INTERNAL_SERVER_ERROR",
    message: "イベントの状態を変更できませんでした。",
  },
] as const) {
  test(`状態変更の ${code} エラーでは状態を変えず案内を表示する`, async ({
    page,
  }) => {
    await open(page, { transitionEventStatusError: code });
    await chooseStatus(page, "Event A", "公開中");
    await statusDialog(page)
      .getByRole("button", { name: "変更する", exact: true })
      .click();
    await expect(statusDialog(page).getByRole("alert")).toHaveText(message);
    await expect(page.getByText(MOCK_SERVER_MESSAGE)).toHaveCount(0);
    await expect(statusTrigger(page, "Event A")).toHaveAccessibleName(
      "「Event A」の状態を変更（下書き）",
    );
  });
}

for (const theme of ["light", "dark"] as const) {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 320, height: 800 },
  ]) {
    test(`${theme} / ${viewport.name} で一覧と長いイベント名を横スクロールせず操作できる`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.addInitScript(
        (theme) => localStorage.setItem("theme", theme),
        theme,
      );
      await open(page);
      if (theme === "dark")
        await expect(page.locator("html")).toHaveClass(/dark/);
      else await expect(page.locator("html")).not.toHaveClass(/dark/);
      await expect(
        page.getByRole("button", { name: "イベントを作成" }),
      ).toBeVisible();
      await expect(
        eventRow(page, "Event A").getByRole("link", {
          name: "「Event A」を管理",
        }),
      ).toHaveText("管理する");
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(
          `event-workspace-${theme}-${viewport.name}.png`,
        ),
        fullPage: true,
      });

      const name =
        "来場者向け展示会・ワークショップ・会場案内の運営管理イベント".repeat(
          3,
        );
      await page.getByRole("button", { name: "イベントを作成" }).click();
      await page.getByRole("textbox", { name: "イベント名" }).fill(name);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "作成", exact: true })
        .click();
      const row = eventRow(page, name);
      await expect(row).toBeVisible();
      const fullName = row.getByText(name, { exact: true });
      await expect(fullName).toHaveAttribute("title", name);
      expect(
        await fullName.evaluate(
          (element) => element.scrollWidth > element.clientWidth,
        ),
      ).toBe(true);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
      const status = row.getByRole("button", { name: /の状態を変更/ });
      await status.click();
      await expect(
        page.getByRole("menuitem", { name: "下書き", exact: true }),
      ).toBeDisabled();
      await page.keyboard.press("Escape");
      await expect(status).toBeFocused();
      await expect(
        row.getByRole("button", { name: /のイベントIDをコピー/ }),
      ).toBeEnabled();
      await expect(
        row.getByRole("link", { name: `「${name}」を管理` }),
      ).toBeVisible();
    });
  }
}

test("サイドバーと状態フィルターが連動し、アーカイブ表示の解除で全イベントに戻る", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const navigation = page.getByRole("navigation", {
    name: "イベントの表示切り替え",
  });
  await navigation.getByRole("radio", { name: "公開中", exact: true }).click();
  await expect(eventList(page).getByRole("listitem")).toHaveCount(1);
  await expect(eventRow(page, "Event B")).toBeVisible();
  await page.getByRole("button", { name: "公開中 状態", exact: true }).click();
  await page.getByRole("option", { name: "ロック中", exact: true }).click();
  await expect(
    navigation.getByRole("radio", { name: "ロック中", exact: true }),
  ).toBeChecked();
  await expect(eventRow(page, "Event C")).toBeVisible();
  await navigation
    .getByRole("radio", { name: "アーカイブ済み", exact: true })
    .click();
  await expect(showArchived(page)).toBeChecked();
  await expect(eventRow(page, "Event E")).toBeVisible();
  await page.getByText("アーカイブ済みも表示", { exact: true }).click();
  await expect(
    navigation.getByRole("radio", { name: "すべてのイベント", exact: true }),
  ).toBeChecked();
  await expect(eventList(page).getByRole("listitem")).toHaveCount(4);
});

test("サイドバーの状態ビューをキーボードで切り替えられる", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const navigation = page.getByRole("navigation", {
    name: "イベントの表示切り替え",
  });
  await navigation
    .getByRole("radio", { name: "すべてのイベント", exact: true })
    .focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    navigation.getByRole("radio", { name: "下書き", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Space");
  await expect(
    navigation.getByRole("radio", { name: "下書き", exact: true }),
  ).toBeChecked();
  await expect(eventRow(page, "Event A")).toBeVisible();
  await expect(eventList(page).getByRole("listitem")).toHaveCount(1);
});
