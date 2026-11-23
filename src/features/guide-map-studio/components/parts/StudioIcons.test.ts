import { describe, expect, it } from "vitest";
import type { MapObject } from "../../type";
import { hasMarkScale } from "./StudioIcons";

const place = (extra: Partial<MapObject>): MapObject =>
  ({
    id: "p",
    kind: "place",
    floor: "f",
    // 標準の色なので、マークは名前から推し量る（tolo-web と同じ）
    color: "slate",
    x: 0,
    y: 0,
    shape: "rect",
    w: 100,
    h: 100,
    ...extra,
  }) as MapObject;

describe("マークの大きさを変えられる物", () => {
  it("目印・部屋の中の目印・種類のマークのある部屋・四角の階段は変えられる", () => {
    expect(hasMarkScale(place({ shape: "pin" }))).toBe(true);
    expect(hasMarkScale(place({ pin: true } as Partial<MapObject>))).toBe(true);
    expect(hasMarkScale(place({ title: "男子トイレ" }))).toBe(true);
    expect(
      hasMarkScale(
        place({ connector: "stairs", link: "l1" } as Partial<MapObject>),
      ),
    ).toBe(true);
  });
  it("マークの無い部屋・ピンの階段（幅と高さで変える）・範囲は変えられない", () => {
    expect(hasMarkScale(place({ title: "401" }))).toBe(false);
    expect(
      hasMarkScale(
        place({
          shape: "pin",
          connector: "stairs",
          link: "l1",
        } as Partial<MapObject>),
      ),
    ).toBe(false);
    expect(
      hasMarkScale({
        id: "a",
        kind: "area",
        floor: "f",
        color: "room",
        points: [],
      }),
    ).toBe(false);
  });
});
