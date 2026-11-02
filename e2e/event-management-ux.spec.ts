import { expect, type Page, test } from "@playwright/test";
import type { MockRouterOverrides } from "@/mocks/router";

const search = (page: Page) =>
  page.getByRole("searchbox", { name: "イベント名・IDで検索" });
const rows = (page: Page) => page.getByRole("main").getByRole("listitem");
const row = (page: Page, name: string) => rows(page).filter({ hasText: name });
const archived = (page: Page) =>
  page.getByRole("checkbox", { name: "アーカイブ済みも表示" });
const view = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "イベントの表示切り替え" })
    .getByRole("radio", { name, exact: true });
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "イベントの状態を変更" });

async function open(page: Page, overrides: MockRouterOverrides = {}) {
  await page.addInitScript(
    (value) => sessionStorage.setItem("msw:overrides", value),
    JSON.stringify(overrides),
  );
  await page.goto("/management");
}

test("URLの条件を再読込・戻る・進むでも維持し、条件を個別に解除できる", async ({
  page,
}) => {
  await page.goto("/management?q=Event&status=open&archived=1");
  await expect(search(page)).toHaveValue("Event");
  await expect(row(page, "Event B")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "適用中の条件" }),
  ).toBeVisible();
  await page.reload();
  await expect(search(page)).toHaveValue("Event");
  await expect(row(page, "Event B")).toBeVisible();
  await view(page, "ロック中").click();
  await expect(row(page, "Event C")).toBeVisible();
  await page.goBack();
  await expect(row(page, "Event B")).toBeVisible();
  await page.goForward();
  await expect(row(page, "Event C")).toBeVisible();
  await page
    .getByRole("button", { name: "検索条件を解除", exact: true })
    .click();
  await expect(search(page)).toHaveValue("");
  await expect(archived(page)).toBeChecked();
  expect(new URL(page.url()).searchParams.get("status")).toBe("locked");
  await page
    .getByRole("button", { name: "状態条件を解除", exact: true })
    .click();
  await expect(rows(page)).toHaveCount(5);
  await page
    .getByRole("button", { name: "アーカイブ表示を解除", exact: true })
    .click();
  await expect(rows(page)).toHaveCount(4);
  await expect(page.getByRole("region", { name: "適用中の条件" })).toHaveCount(
    0,
  );
});

for (const way of ["history", "link"] as const) {
  test(`個別管理画面から ${way} で戻ると条件と閲覧位置が復元される`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    const events = Array.from({ length: 60 }, (_, i) => ({
      eventId: (i + 1).toString(16).padStart(16, "0"),
      name: `Event ${(i + 1).toString().padStart(2, "0")}`,
      status: "open" as const,
    }));
    await open(page, { events });
    await search(page).fill("Event");
    await view(page, "公開中").click();
    await page
      .locator("label")
      .filter({ hasText: "アーカイブ済みも表示" })
      .click();
    const event = row(page, "Event 35");
    await event.scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => window.scrollY);
    expect(y).toBeGreaterThan(500);
    await event
      .getByRole("link", { name: "「Event 35」を管理", exact: true })
      .click();
    await expect(page).toHaveURL("/event/0000000000000023/management");
    if (way === "history") await page.goBack();
    else await page.getByRole("link", { name: "イベント一覧に戻る" }).click();
    await expect(search(page)).toHaveValue("Event");
    await expect(archived(page)).toBeChecked();
    expect(new URL(page.url()).searchParams.get("status")).toBe("open");
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(y - 100);
    await expect(event).toBeInViewport();
  });
}

test("不正な状態の直接URLは既定値になり、戻り先は外部ホストにできない", async ({
  page,
}) => {
  await page.goto("/management?status=unknown&archived=bad&q=Event");
  await expect(rows(page)).toHaveCount(4);
  await expect(archived(page)).not.toBeChecked();
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "tolo:event-list:0123456789abcdef",
      JSON.stringify({
        search: "next=https://other.example&status=open",
        y: 0,
      }),
    ),
  );
  await page.goto("/event/0000000000000001/management");
  await expect(
    page.getByRole("link", { name: "イベント一覧に戻る" }),
  ).toHaveAttribute("href", "/management?status=open");
});

test("未作成の案内から作成でき、作成通知が重複せず次の操作へ進める", async ({
  page,
}) => {
  await open(page, { events: [] });
  const region = page.getByRole("region", { name: "イベント", exact: true });
  await expect(region).toContainText("イベントはまだありません。");
  await region
    .getByRole("button", { name: "イベントを作成", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "イベント名", exact: true })
    .fill("First event");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "作成", exact: true })
    .click();
  await expect(row(page, "First event")).toBeVisible();
  const notice = page
    .getByRole("status")
    .filter({ hasText: "「First event」を作成しました。" });
  await expect(notice).toHaveCount(1);
  await expect(
    page.getByText("イベントを作成しました。", { exact: true }),
  ).toHaveCount(0);
  await expect(
    notice.getByRole("link", { name: "イベント種別を設定する" }),
  ).toHaveAttribute("href", "/event/0000000000000001/management");
  await page.getByRole("button", { name: "通知を閉じる" }).click();
  await expect(notice).toHaveCount(0);
});

test("下書きの非活性理由がキーボードでも読め、前後の状態と実行内容を確認できる", async ({
  page,
}) => {
  await open(page);
  const trigger = row(page, "Event A").getByRole("button", {
    name: /の状態を変更/,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(
      "下書きは作成時の状態です。他の状態から下書きには戻せません。",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole("menu")).toHaveAccessibleDescription(
    "下書きは作成時の状態です。他の状態から下書きには戻せません。",
  );
  await page
    .getByRole("menuitem", { name: "公開する", exact: true })
    .press("Enter");
  await expect(dialog(page)).toContainText("Event A");
  await expect(dialog(page)).toContainText("下書き");
  await expect(dialog(page)).toContainText("公開中");
  await expect(
    dialog(page).getByRole("button", { name: "公開する", exact: true }),
  ).toBeVisible();
});

test("状態変更の送信中は再送と閉じる操作を防ぐ", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.fetch;
    Object.assign(window, { transitionCalls: 0, releaseTransition: () => {} });
    window.fetch = async function (input, init) {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : input.toString();
      if (url.includes("/tenant/transitionEventStatus")) {
        (window as unknown as { transitionCalls: number }).transitionCalls++;
        await new Promise<void>((resolve) =>
          Object.assign(window, { releaseTransition: resolve }),
        );
      }
      return original.call(this, input, init);
    };
  });
  await open(page);
  await row(page, "Event A")
    .getByRole("button", { name: /の状態を変更/ })
    .click();
  await page.getByRole("menuitem", { name: "公開する", exact: true }).click();
  const confirm = dialog(page).getByRole("button", {
    name: "公開する",
    exact: true,
  });
  await confirm.click();
  await expect(confirm).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { transitionCalls: number }).transitionCalls,
    ),
  ).toBe(1);
  await page.evaluate(() =>
    (
      window as unknown as { releaseTransition: () => void }
    ).releaseTransition(),
  );
  await expect(dialog(page)).toHaveCount(0);
});

test("空の一覧でも条件指定中は未作成と区別し、解除すると作成案内を表示する", async ({
  page,
}) => {
  await open(page, { events: [] });
  await search(page).fill("文化祭");
  await expect(
    page.getByText("条件に一致するイベントがありません。", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("イベントはまだありません。", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "条件を解除する", exact: true })
    .click();
  await expect(
    page.getByText("イベントはまだありません。", { exact: true }),
  ).toBeVisible();
});

test("英語でも適用条件・状態操作・非活性理由を表示できる", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: "http://test.localhost:3100" },
  ]);
  await page.goto("/management?q=Event&status=open");
  await expect(
    page.getByRole("heading", { name: "Event management", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Active filters" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Change status for Event B (Open)",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Lock", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Draft is the initial state. Events cannot return to draft from another state.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("スマートフォンの主要アイコンと管理操作は44px以上のタップ領域を持つ", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await open(page);
  const event = row(page, "Event A");
  for (const control of [
    event.getByRole("button", { name: /のイベントIDをコピー/ }),
    event.getByRole("button", { name: /の状態を変更/ }),
    event.getByRole("button", { name: /のその他の操作/ }),
    event.getByRole("link", { name: "「Event A」を管理", exact: true }),
  ]) {
    const box = await control.boundingBox();
    if (!box) throw new Error("Control is not visible");
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
});
