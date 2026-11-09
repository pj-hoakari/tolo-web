import { describe, expect, it } from "vitest";
import type { MapObject } from "./guideMapLayout";
import {
  areaPalette,
  buildingAreaOf,
  displayName,
  placeCategory,
  placePalette,
  splitName,
} from "./guideMapStyle";

const area = (
  id: string,
  size: number,
  color = "slate",
): Extract<MapObject, { kind: "area" }> => ({
  id,
  kind: "area",
  groupId: "f1",
  color,
  points: [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size },
  ],
});
const room = (id: string, x: number, y: number): MapObject => ({
  id,
  kind: "place",
  groupId: "f1",
  color: "indigo",
  shape: "rect",
  x,
  y,
  w: 40,
  h: 40,
});

describe("placeCategory", () => {
  it.each([
    ["女子トイレ", "toilet-women"],
    ["男子トイレ", "toilet-men"],
    ["男子・女子トイレ", "toilet"],
    ["Women's restroom", "toilet-women"],
    ["Men's restroom", "toilet-men"],
    ["ラウンジ", "rest"],
    ["カフェ", "food"],
    ["受付", "info"],
    ["職員室", "info"],
    ["多目的トイレ", "toilet-accessible"],
    ["救護室", "first-aid"],
    ["授乳室", "nursing"],
    ["売店", "shop"],
    ["自販機コーナー", "vending"],
    ["喫煙所", "smoking"],
    ["クローク", "locker"],
    ["充電スポット", "charging"],
    ["集合場所", "meeting"],
    ["西口 出入口", "entrance"],
    ["403", "room"],
  ])("「%s」は %s", (name, category) => {
    expect(placeCategory(name)).toBe(category);
  });
});

describe("案内マップエディタで選んだ種類（色の項目）", () => {
  it("種類が入っていれば名前より優先する", () => {
    expect(placeCategory("1F 東側", "toilet-women")).toBe("toilet-women");
    expect(placeCategory("女子トイレ", "room")).toBe("room");
    expect(placeCategory("ホール", "exhibit")).toBe("exhibit");
  });

  it("種類が入っていない古い色の名前なら、名前から推し量る", () => {
    expect(placeCategory("女子トイレ", "indigo")).toBe("toilet-women");
  });

  it("種類の色で塗り、部屋は中立色", () => {
    expect(placePalette("toilet-women", "toilet-women").fill).toBe(
      "var(--guest-map-rose-fill)",
    );
    expect(placePalette("exhibit", "exhibit").fill).toBe(
      "var(--guest-map-violet-fill)",
    );
    expect(placePalette("room", "room").fill).toBe(
      "var(--guest-map-room-fill)",
    );
  });

  it("エリアは種類の色、部屋と建物の外枠は中立色", () => {
    expect(areaPalette("rest").fill).toBe("var(--guest-map-amber-fill)");
    expect(areaPalette("building").fill).toBe("var(--guest-map-room-fill)");
    expect(areaPalette("room").fill).toBe("var(--guest-map-room-fill)");
  });
});

describe("男女両方のトイレの色", () => {
  it("男性（青）と女性（赤）を混ぜた色にする", () => {
    const { fill } = placePalette("toilet", "toilet");
    expect(fill).toContain("color-mix");
    expect(fill).toContain("--guest-map-rose-fill");
    expect(fill).toContain("--guest-map-sky-fill");
    expect(placePalette("toilet-accessible", "toilet-accessible").fill).toBe(
      fill,
    );
  });
});

describe("placePalette", () => {
  it("標準の色（以前の既定の indigo を含む）の普通の部屋は中立色", () => {
    expect(placePalette("indigo", "room").fill).toBe(
      "var(--guest-map-room-fill)",
    );
    expect(placePalette("slate", "room").fill).toBe(
      "var(--guest-map-room-fill)",
    );
  });

  it("標準の色のトイレは種類の色、案内マップエディタで選んだ色はそのまま", () => {
    expect(placePalette("indigo", "toilet-women").fill).toBe(
      "var(--guest-map-rose-fill)",
    );
    expect(placePalette("violet", "toilet-women").fill).toBe(
      "var(--guest-map-violet-fill)",
    );
  });

  it("標準の色のエリアは中立色", () => {
    expect(areaPalette("indigo").fill).toBe("var(--guest-map-room-fill)");
  });
});

describe("displayName / splitName", () => {
  it("全角の英数字を半角に直す", () => {
    expect(displayName("４０３")).toBe("403");
    expect(displayName("KCG本館４F")).toBe("KCG本館4F");
  });

  it("区切り記号・よくある語尾の前で 2 行に分ける", () => {
    expect(splitName("男子・女子トイレ")).toEqual(["男子", "女子トイレ"]);
    expect(splitName("女子トイレ")).toEqual(["女子", "トイレ"]);
    expect(splitName("ABCDEF")).toEqual(["ABC", "DEF"]);
  });
});

describe("buildingAreaOf", () => {
  it("用途を「建物の外枠」にしたエリア（色キー building）を外枠にする", () => {
    const outline = area("outline", 100, "building");
    expect(
      buildingAreaOf([area("big", 1000), outline, room("r", 10, 10)]),
    ).toBe(outline);
  });

  it("指定が無ければ、場所の半分以上を含むいちばん大きいエリアを外枠とみなす", () => {
    const big = area("big", 500);
    const objects = [
      area("small", 100),
      big,
      room("a", 50, 50),
      room("b", 300, 300),
    ];
    expect(buildingAreaOf(objects)).toBe(big);
  });

  it("場所を含まないエリアしか無ければ外枠は無い", () => {
    expect(buildingAreaOf([area("lawn", 100), room("a", 900, 900)])).toBe(
      undefined,
    );
  });
});
