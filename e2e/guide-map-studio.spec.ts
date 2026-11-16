import { expect, type Page, test } from "@playwright/test";
import {
  createStaffStorageScope,
  scopeStaffStorageKey,
} from "@/lib/pwa/staff-storage";
import { SAVED_GUIDE_MAP_KEY } from "@/mocks/overrides";
import type { MockRouterOverrides } from "@/mocks/router";
import type { SavedGuideMap } from "@/server/router";

test.use({ viewport: { width: 1600, height: 1000 } });

const editPath = "/event/test/management/guide-map/edit";
const bookKey = `guide-map-studio:book:${scopeStaffStorageKey("test", createStaffStorageScope("0123456789abcdef", { type: "staff", userId: "user-owner" }))}`;
const floorTab = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
// 「保存ポイント」と分けるため、名前が「保存」で始まるヘッダーの保存ボタンだけを取る
const saveButton = (page: Page) =>
  page.locator("header").getByRole("button", { name: /^保存(?!ポイント)/ });

const open = async (
  page: Page,
  {
    overrides,
    saved,
    search = "",
  }: {
    overrides?: Pick<
      MockRouterOverrides,
      "saveGuideMapLayoutError" | "getGuideMapLayoutError"
    >;
    saved?: SavedGuideMap;
    search?: string;
  } = {},
) => {
  await page.addInitScript(
    ({ overrides, saved, key }) => {
      if (overrides) sessionStorage.setItem("msw:overrides", overrides);
      if (saved) localStorage.setItem(key, saved);
    },
    {
      overrides: overrides && JSON.stringify(overrides),
      saved: saved && JSON.stringify(saved),
      key: SAVED_GUIDE_MAP_KEY,
    },
  );
  await page.goto(`${editPath}${search}`);
};

test("開発サーバーのモックでは、スタジオに KCG本館の見本が最初から入っている", async ({
  page,
}) => {
  await open(page);

  await expect(floorTab(page, "1F")).toBeVisible();
  await expect(floorTab(page, "6Fホール")).toBeVisible();
  // 保存されている地図そのままなので、保存していない変更は無い
  await expect(saveButton(page)).toHaveAccessibleName("保存");
});

test("保存した地図はブラウザのモックに残り、開き直すとその地図が開く", async ({
  page,
}) => {
  await open(page, {
    saved: {
      layout: {
        version: 1,
        groups: [{ groupId: "g_0eb36458" }],
        objects: [
          {
            id: "t-1",
            kind: "text",
            groupId: "g_0eb36458",
            color: "slate",
            title: { ja: "保存した地図" },
            x: 100,
            y: 100,
            size: 20,
          },
        ],
        north: 0,
        scale: 0,
      },
      groupLabels: { g_0eb36458: { ja: "1F" } },
    },
  });

  await expect(floorTab(page, "1F")).toBeVisible();
  await expect(floorTab(page, "6Fホール")).toHaveCount(0);
});

test("保存すると、保存した地図をブラウザのモックに残す", async ({ page }) => {
  await open(page);
  await expect(floorTab(page, "6Fホール")).toBeVisible();

  await saveButton(page).click();

  await expect(saveButton(page)).toHaveAccessibleName("保存しました");
  const stored = await page.evaluate(
    (key) => localStorage.getItem(key),
    SAVED_GUIDE_MAP_KEY,
  );
  expect(
    (JSON.parse(stored ?? "{}") as SavedGuideMap).layout.groups,
  ).toHaveLength(6);
});

test("保存を断られると、地図の中身を確かめるよう案内する", async ({ page }) => {
  await open(page, { overrides: { saveGuideMapLayoutError: "BAD_REQUEST" } });
  await expect(floorTab(page, "6Fホール")).toBeVisible();

  await saveButton(page).click();

  await expect(page.getByRole("dialog")).toContainText(
    "tolo-web が地図を受け付けませんでした",
  );
});

test("開くと、イベントのグラフを取って地図に結び付ける", async ({ page }) => {
  const request = page.waitForRequest("**/rpc/graph/getGraph");

  await open(page, { search: "?layoutFixture=guide-map" });

  expect((await request).postDataJSON()).toEqual({
    json: { eventId: "test" },
  });
  // 一時保存した地図に、KCG本館の誘導グラフ（階段・エレベーター・廊下など 23 か所）が入る
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const raw = localStorage.getItem(key);
        const book = raw
          ? (JSON.parse(raw) as {
              pages: { doc: { graph?: { points: unknown[] } } }[];
            })
          : undefined;
        return book?.pages[0]?.doc.graph?.points.length ?? 0;
      }, bookKey),
    )
    .toBe(23);
});

test("保存した地図を読み込めないと知らせ、もう一度読み込める", async ({
  page,
}) => {
  await open(page, { overrides: { getGuideMapLayoutError: true } });

  const alert = page
    .getByRole("alert")
    .filter({ hasText: "tolo-web から読み込めませんでした" });
  await expect(alert).toBeVisible();
  await expect(floorTab(page, "6Fホール")).toHaveCount(0);

  // 失敗の設定を外してから、もう一度読み込む
  await page.evaluate(() => {
    sessionStorage.removeItem("msw:overrides");
    window.dispatchEvent(new Event("msw:overrides"));
  });
  await alert.getByRole("button", { name: "もう一度読み込む" }).click();

  await expect(alert).toHaveCount(0);
  await expect(floorTab(page, "6Fホール")).toBeVisible();
});
