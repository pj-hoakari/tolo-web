import { describe, expect, it } from "vitest";
import { hitTest } from "./hitTest";
import type { MapObject } from "./venueMap";

const room = (id: string, x: number, y: number): MapObject => ({
  id,
  kind: "place",
  floor: "f",
  color: "room",
  x,
  y,
  shape: "rect",
  w: 100,
  h: 80,
  title: id,
});
const area: MapObject = {
  id: "area",
  kind: "area",
  floor: "f",
  color: "room",
  points: [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 300 },
    { x: 0, y: 300 },
  ],
};

describe("当たり判定", () => {
  it("部屋の中を押すと、その部屋", () => {
    expect(hitTest([room("a", 100, 100)], { x: 120, y: 110 }, 1)).toBe("a");
    expect(hitTest([room("a", 100, 100)], { x: 300, y: 300 }, 1)).toBeNull();
  });
  it("重なっていたら、上（配列の後ろ）の物", () => {
    const objs = [room("下", 100, 100), room("上", 120, 100)];
    expect(hitTest(objs, { x: 110, y: 100 }, 1)).toBe("上");
  });
  it("範囲は、編集中は枠線だけで掴み、内側はクリックしただけのときに拾う", () => {
    expect(hitTest([area], { x: 200, y: 1 }, 1)).toBe("area");
    expect(hitTest([area], { x: 200, y: 150 }, 1)).toBeNull();
    expect(hitTest([area], { x: 200, y: 150 }, 1, true)).toBe("area");
  });
  it("部屋は範囲より先に拾う（範囲の内側でも、上にある部屋）", () => {
    expect(
      hitTest([area, room("a", 200, 150)], { x: 200, y: 150 }, 1, true),
    ).toBe("a");
  });
});
