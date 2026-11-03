import { expect, type Page, test } from "@playwright/test";
import { GUEST_REFRESH_INTERVAL_MS } from "@/features/guest/useGuestPolling";
import type { MockRouterOverrides } from "@/mocks/router";

const destinationSelect = (page: Page, name: string | RegExp = /目的地/) =>
  page.getByRole("button", { name });
const reset = (page: Page) => page.getByRole("button", { name: "リセット" });
/** 目的地のプルダウンを開いて、名前の目的地を選ぶ（同じ名前が複数あるときは先頭） */
const pickDestination = async (page: Page, name: string) => {
  await destinationSelect(page).click();
  await page.getByRole("option", { name, exact: true }).first().click();
};
const localeButton = (page: Page) =>
  page.getByRole("button", { name: "言語を切り替え" });
const themeButton = (page: Page) =>
  page.getByRole("button", { name: "テーマを切り替え" });
const staffMessageBell = (page: Page) =>
  page.getByRole("button", { name: "スタッフからのお知らせ" });
const staffMessageDialog = (page: Page) =>
  page.getByRole("dialog", { name: "スタッフからのお知らせ" });
const card = (page: Page, title: string) =>
  page
    .locator("section")
    .filter({ has: page.getByRole("heading", { level: 2, name: title }) });
const congestionCard = (page: Page) => card(page, "混雑状況");
const queuesCard = (page: Page) => card(page, "行列の待ち時間");
const guideMapCard = (page: Page) => card(page, "案内マップ");
/** 案内マップの上の、表示中の階の切り替え */
const floorTabs = (page: Page, name = "表示するフロア") =>
  page.getByRole("radiogroup", { name }).first();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const openGuestPage = async (
  page: Page,
  path: string,
  overrides?: Pick<MockRouterOverrides, "guestComponents" | "getGuideMapError">,
) => {
  if (overrides) {
    await page.addInitScript((value) => {
      sessionStorage.setItem("msw:overrides", value);
    }, JSON.stringify(overrides));
  }
  await page.goto(path);
};

test.beforeEach(async ({ page }) => {
  const opened = page.waitForResponse("**/rpc/guest/openGuestPage");
  const guideMap = page.waitForResponse("**/rpc/guest/getGuideMap");
  await page.goto("/event/test/guest");
  await Promise.all([opened, guideMap]);
  await expect(
    page.getByRole("heading", { level: 1, name: "0123456789abcdef" }),
  ).toBeVisible();
});

test("ゲストページを開くと各情報セクションの見出しが表示される", async ({
  page,
}) => {
  for (const title of ["案内マップ", "行列の待ち時間", "混雑状況"]) {
    await expect(
      page.getByRole("heading", { level: 2, name: title }),
    ).toBeVisible();
  }
});

test("QR の URL からゲストページを開くと混雑状況と行列とお知らせに Guest Service の内容が表示される", async ({
  page,
}) => {
  await openGuestPage(page, "/event/test/guest/gate-east");

  const congestion = congestionCard(page);
  await expect(
    congestion
      .getByRole("listitem")
      .filter({ hasText: "1F〜6F エレベーター前" }),
  ).toContainText("危険");
  await expect(
    congestion.getByRole("listitem").filter({ hasText: "6F ホール" }),
  ).not.toContainText("危険");
  await expect(congestion).toContainText("14:28 更新");
  await expect(queuesCard(page).getByRole("listitem")).toHaveCount(2);
  await expect(staffMessageBell(page)).toHaveText("2");
});

test("QR の URL から開くと設置箇所 ID とセッション ID を添えてページを開いたことを Guest Service に伝える", async ({
  page,
}) => {
  const path = `/event/test/guest/${encodeURIComponent("東 ゲート")}`;
  const first = page.waitForRequest("**/rpc/guest/openGuestPage");
  await openGuestPage(page, path);

  const { json } = (await first).postDataJSON();
  expect(json).toMatchObject({ eventId: "test", qrLocationId: "東 ゲート" });
  expect(json.sessionId).toMatch(uuid);

  const second = page.waitForRequest("**/rpc/guest/openGuestPage");
  await page.reload();
  expect((await second).postDataJSON().json.sessionId).toBe(json.sessionId);
});

test("QR のない URL から開くと設置箇所 ID を空にしてページを開いたことを Guest Service に伝える", async ({
  page,
}) => {
  const request = page.waitForRequest("**/rpc/guest/openGuestPage");
  await openGuestPage(page, "/event/test/guest");

  expect((await request).postDataJSON().json).toMatchObject({
    eventId: "test",
    qrLocationId: "",
  });
});

test("ページ構成に含まれない混雑状況とお知らせは表示されない", async ({
  page,
}) => {
  await openGuestPage(page, "/event/test/guest/gate-east", {
    guestComponents: ["queues"],
  });

  await expect(queuesCard(page)).toBeVisible();
  await expect(congestionCard(page)).toHaveCount(0);
  await expect(staffMessageBell(page)).toHaveCount(0);
});

test("行列ごとに切り上げた待ち時間とおすすめの入口だけが表示される", async ({
  page,
}) => {
  const hall = queuesCard(page)
    .getByRole("listitem")
    .filter({ hasText: "6F ホール" });

  await expect(hall).toContainText("約13分");
  await expect(hall).toContainText("おすすめの入口: 階段");
  await expect(hall).not.toContainText("エレベーター");
});

test("言語を切り替えると混雑状況と行列の表示名を切り替えた言語で取り直す", async ({
  page,
}) => {
  await expect(congestionCard(page)).toContainText("1F〜6F エレベーター前");

  await localeButton(page).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();

  await expect(card(page, "Congestion")).toContainText("1F–6F elevators");
  await expect(card(page, "Queue wait times")).toContainText("6F Hall");
});

test("お知らせを開いて既読にすると再読み込みしても未読バッジは出ない", async ({
  page,
}) => {
  const bell = staffMessageBell(page);
  await expect(bell).toHaveText("2");
  await bell.click();
  await expect(staffMessageDialog(page)).toBeVisible();
  await page.keyboard.press("Escape");

  await page.reload();

  await expect(queuesCard(page)).toBeVisible();
  await expect(staffMessageBell(page)).toBeVisible();
  await expect(staffMessageBell(page)).not.toHaveText("2");
});

test("QR の URL から開いたページをインストールすると QR のないゲストページから起動する", async ({
  page,
}) => {
  await openGuestPage(page, "/event/test/guest/gate-east");

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    `/manifest.webmanifest?start=${encodeURIComponent("/event/test/guest")}`,
  );
});

test("お知らせボタンを押すとスタッフからのお知らせ一覧が開き未読バッジが消える", async ({
  page,
}) => {
  const bell = staffMessageBell(page);
  await expect(bell).toHaveText("2");
  await expect(bell).toHaveAttribute("aria-expanded", "false");

  await bell.click();

  const dialog = staffMessageDialog(page);
  await expect(dialog).toBeVisible();
  await expect(bell).toHaveAttribute("aria-expanded", "true");
  await expect(bell).toHaveAttribute(
    "aria-controls",
    (await dialog.getAttribute("id")) ?? "",
  );
  await expect(bell).not.toHaveText("2");
  const list = dialog.getByRole("list");
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list).toContainText("1F エレベーター前が大変混雑しています。");
  await expect(list).toContainText("06/15 14:30");
});

test("お知らせ一覧はキーボードで開き Escape で閉じるとベルにフォーカスが戻る", async ({
  page,
}) => {
  const bell = staffMessageBell(page);
  await bell.focus();
  await page.keyboard.press("Enter");

  const dialog = staffMessageDialog(page);
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { level: 2, name: "スタッフからのお知らせ" }),
  ).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(dialog).toBeHidden();
  await expect(bell).toHaveAttribute("aria-expanded", "false");
  await expect(bell).toBeFocused();
});

test("お知らせ一覧の外側を押すとお知らせ一覧が閉じる", async ({ page }) => {
  await staffMessageBell(page).click();
  const dialog = staffMessageDialog(page);
  await expect(dialog).toBeVisible();

  await page.mouse.click(5, 300);

  await expect(dialog).toBeHidden();
  const bell = staffMessageBell(page);
  await expect(bell).toHaveAttribute("aria-expanded", "false");
  await expect(bell).not.toHaveText("2");
});

test("目的地のプルダウンを開くと目的地が階ごとにまとまって並び、現在地は出ない", async ({
  page,
}) => {
  await destinationSelect(page).click();

  // 2F と 3F の両方に職員室があり、それぞれの階の見出しの下に並ぶ
  for (const floor of ["2F", "3F"]) {
    await expect(
      page
        .getByRole("group", { name: floor })
        .getByRole("option", { name: "職員室", exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByRole("option", { name: "現在地" })).toHaveCount(0);
});

test("プルダウンから目的地を選ぶと選んだ目的地と階がボタンに表示される", async ({
  page,
}) => {
  await pickDestination(page, "204");

  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(destinationSelect(page)).toContainText("204");
  await expect(destinationSelect(page)).toContainText("2F");
  await expect(reset(page)).toBeVisible();
});

test("キーボードだけでプルダウンを開いて目的地を選べる", async ({ page }) => {
  await destinationSelect(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toBeVisible();

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(reset(page)).toBeVisible();
});

test("選んだ目的地をリセットすると選択が解除される", async ({ page }) => {
  await pickDestination(page, "204");

  await reset(page).click();

  await expect(reset(page)).toBeHidden();
  await expect(destinationSelect(page)).toContainText("目的地を選んでください");
});

test("地図をタップすると拡大し、もう一度タップすると全体表示に戻る", async ({
  page,
}) => {
  const map = page.getByRole("img", { name: "案内マップ" });
  const fullView = await map.getAttribute("viewBox");

  await map.click();
  await expect(
    page.getByText("ドラッグで移動・タップで全体表示"),
  ).toBeVisible();
  await expect(map).not.toHaveAttribute("viewBox", fullView ?? "");

  // 全体表示に戻ったら、拡大中の案内は消える
  await map.click();
  await expect(map).toHaveAttribute("viewBox", fullView ?? "");
  await expect(page.getByText("ドラッグで移動・タップで全体表示")).toHaveCount(
    0,
  );
});

test("別の階の目的地を選ぶと階移動を含む道順が出て、表示中の階が地図と連動する", async ({
  page,
}) => {
  const floorCard = floorTabs(page);
  await pickDestination(page, "204");

  await expect(page.getByText(/で 1F → 2F$/)).toBeVisible();
  await expect(floorCard.getByRole("radio", { name: "1F" })).toBeChecked();
  await expect(page.getByText(/^▲ .+で2Fへ$/)).toBeVisible();

  // 道順の 2F の区間を押すと、地図と表示中の階が 2F に切り替わる
  await page.getByRole("button", { name: /^2F：/ }).click();
  await expect(floorCard.getByRole("radio", { name: "2F" })).toBeChecked();
  await expect(page.getByText("1Fから到着")).toBeVisible();

  // 階の切り替えで 1F を選ぶと地図も 1F に戻る
  await floorCard.getByRole("radio", { name: "1F" }).click();
  await expect(floorCard.getByRole("radio", { name: "1F" })).toBeChecked();
});

test("道順は番号付きで並び、「次へ」で次に歩く階の地図に送れる", async ({
  page,
}) => {
  await pickDestination(page, "204");

  const steps = page.getByRole("list", { name: "道順" }).getByRole("listitem");
  await expect(steps.first()).toContainText("1F：現在地");
  await page.getByRole("button", { name: "次へ：2Fの道順" }).click();

  await expect(
    floorTabs(page).getByRole("radio", { name: "2F" }),
  ).toBeChecked();
  await expect(page.getByRole("button", { name: /^2F：/ })).toHaveAttribute(
    "aria-current",
    "step",
  );
  // 最後の階まで来たら「次へ」は出ない
  await expect(page.getByRole("button", { name: /^次へ/ })).toHaveCount(0);
});

test("混雑状況の場所の「地図で見る」で、目的地ならそこへの道順が出る", async ({
  page,
}) => {
  await congestionCard(page)
    .getByRole("button", { name: "6F ホールを地図で見る" })
    .click();

  await expect(destinationSelect(page)).toContainText("ホール");
  await expect(page.getByRole("list", { name: "道順" })).toBeVisible();
});

test("混雑状況の場所の「地図で見る」で、目的地でない場所はその階を開いて強調する", async ({
  page,
}) => {
  await floorTabs(page).getByRole("radio", { name: "3F" }).click();

  await congestionCard(page)
    .getByRole("button", { name: "1F〜6F エレベーター前を地図で見る" })
    .click();

  await expect(
    floorTabs(page).getByRole("radio", { name: "1F" }),
  ).toBeChecked();
  await expect(reset(page)).toHaveCount(0);
});

test("地図に無い場所の混雑には「地図で見る」が出ない", async ({ page }) => {
  await expect(
    congestionCard(page).getByRole("listitem").filter({ hasText: "4F 廊下" }),
  ).toBeVisible();
  await expect(
    congestionCard(page).getByRole("button", { name: /4F 廊下を地図で見る/ }),
  ).toHaveCount(0);
});

test("混雑状況は、同じ場所・同じ段階で階だけ違うものを 1 行にまとめる", async ({
  page,
}) => {
  const rows = congestionCard(page).getByRole("listitem");
  await expect(rows).toHaveCount(4);
  await expect(rows.filter({ hasText: "1F〜6F エレベーター前" })).toContainText(
    "危険",
  );
  await expect(rows.filter({ hasText: "1F〜2F 中央階段" })).toContainText("中");
  await expect(rows.filter({ hasText: /^3F エレベーター前/ })).toHaveCount(0);
});

test("混雑状況は危険な場所から順に並ぶ", async ({ page }) => {
  await expect(
    congestionCard(page).getByRole("listitem").first(),
  ).toContainText("1F〜6F エレベーター前");
});

test("行列のおすすめの入口の「地図で見る」で案内マップにその入口の階を開く", async ({
  page,
}) => {
  // API モックでは 6F ホールの行列のおすすめの入口が 6Fホール の階段
  await queuesCard(page)
    .getByRole("button", { name: "階段を地図で見る" })
    .click();

  await expect(
    floorTabs(page).getByRole("radio", { name: "6Fホール" }),
  ).toBeChecked();
});

test("混雑状況で危険なエレベーターは避け、階段を使う道順と混雑の表示が出る", async ({
  page,
}) => {
  // API モックでは 1F エレベーター前が危険（地図の 1F エレベーターに結び付けてある）
  await pickDestination(page, "403");

  await expect(page.getByRole("status")).toHaveText(
    "混雑している所を避けたルートです",
  );
  await expect(page.getByText(/^階段で 1F → /)).toBeVisible();
  await expect(page.getByText(/^エレベーターで 1F → /)).toHaveCount(0);
  await expect(page.getByText("危険", { exact: true }).first()).toBeVisible();
});

test("言語を English に切り替えると英語で表示され再読み込み後も維持される", async ({
  page,
}) => {
  await localeButton(page).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();

  await expect(
    page.getByRole("heading", { level: 2, name: "Guide map" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.reload();
  await expect(page.getByText("Guest Page")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("案内マップはページを開いたときに 1 回だけ取得し、混雑状況が更新されても取り直さない", async ({
  page,
}) => {
  await page.clock.install();
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  const count = (procedure: string) =>
    requests.filter((url) => url.includes(`/rpc/guest/${procedure}`)).length;
  await openGuestPage(page, "/event/test/guest");
  await expect(destinationSelect(page)).toBeVisible();
  const crowdBefore = count("getCrowd");

  await page.clock.runFor(GUEST_REFRESH_INTERVAL_MS * 2 + 1_000);

  await expect.poll(() => count("getCrowd")).toBeGreaterThan(crowdBefore);
  expect(count("getGuideMap")).toBe(1);
});

test("案内マップを取得できないと案内マップのカードに情報を取得できなかったことが表示される", async ({
  page,
}) => {
  await openGuestPage(page, "/event/test/guest", { getGuideMapError: true });

  await expect(guideMapCard(page)).toContainText("情報を取得できませんでした");
  await expect(destinationSelect(page)).toHaveCount(0);
  // 1F〜6F エレベーター前・1F〜2F 中央階段・6F ホール・4F 廊下（同じ場所・同じ段階の階はまとめる）
  await expect(congestionCard(page).getByRole("listitem")).toHaveCount(4);
});

test("言語を English に切り替えると目的地の名前がグラフのポイントの英語のラベルで出る", async ({
  page,
}) => {
  await localeButton(page).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();

  await destinationSelect(page, /Destinations/).click();
  await expect(
    page.getByRole("option", { name: "Staff room", exact: true }),
  ).toHaveCount(2);
  await expect(page.getByRole("option", { name: "職員室" })).toHaveCount(0);
});

test("言語を English に切り替えると地図の上の場所の名前もグラフのポイントの英語のラベルで出る", async ({
  page,
}) => {
  await localeButton(page).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();

  const map = page.getByRole("img", { name: "Guide map" });
  await expect(map.getByText("Stairs")).toHaveCount(2);
  await expect(map.getByText("階段")).toHaveCount(0);
});

test("言語を English に切り替えると階の切り替えの階の名前がグラフのグループの英語のラベルで出る", async ({
  page,
}) => {
  await localeButton(page).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();

  const floorCard = floorTabs(page, "Floor to show");
  await expect(floorCard.getByRole("radio", { name: "6F Hall" })).toBeVisible();
  await expect(floorCard.getByRole("radio", { name: "6Fホール" })).toHaveCount(
    0,
  );
});

test("4F の QR の URL から開くと案内マップは 4F の現在地から始まる", async ({
  page,
}) => {
  await openGuestPage(page, "/event/test/guest/a84d0e6c2b9f1735");

  await expect(
    floorTabs(page).getByRole("radio", { name: "4F" }),
  ).toBeChecked();
  await expect(
    page.getByRole("img", { name: "案内マップ" }).getByText("現在地"),
  ).toBeVisible();
});

test("登録のない QR の URL から開くと設置箇所 ID を添えて案内マップを取得し、既定の出発地から始まる", async ({
  page,
}) => {
  const request = page.waitForRequest("**/rpc/guest/getGuideMap");
  await openGuestPage(page, "/event/test/guest/gate-east");
  const { json } = (await request).postDataJSON();
  expect(json).toMatchObject({ eventId: "test", qrLocationId: "gate-east" });

  await expect(
    floorTabs(page).getByRole("radio", { name: "1F" }),
  ).toBeChecked();
  await expect(
    page.getByRole("img", { name: "案内マップ" }).getByText("現在地"),
  ).toBeVisible();
});

test("言語メニューを開くと 7 つの言語が並び現在の日本語が選ばれている", async ({
  page,
}) => {
  await localeButton(page).click();

  await expect(page.getByRole("menuitemradio")).toHaveCount(7);
  await expect(
    page.getByRole("menuitemradio", { name: "日本語" }),
  ).toHaveAttribute("aria-checked", "true");
});

test("言語メニューは Escape で閉じフォーカスがボタンに戻る", async ({
  page,
}) => {
  await localeButton(page).click();
  await expect(page.getByRole("menu")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(localeButton(page)).toBeFocused();
});

test("キーボードだけで言語を English に切り替えられる", async ({ page }) => {
  await localeButton(page).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("menuitemradio", { name: "日本語" }),
  ).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitemradio", { name: "English" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("テーマをダークに切り替えるとダークテーマが適用され再読み込み後も維持される", async ({
  page,
}) => {
  await themeButton(page).click();
  await page.getByRole("menuitemradio", { name: "ダーク" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
});

test("テーマをライトに切り替えるとダークテーマが外れる", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await themeButton(page).click();
  await page.getByRole("menuitemradio", { name: "ライト" }).click();

  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
});

test("テーマがシステムのときは OS の配色設定に従う", async ({ page }) => {
  await themeButton(page).click();
  await expect(
    page.getByRole("menuitemradio", { name: "システム" }),
  ).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
});
