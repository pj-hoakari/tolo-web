import { describe, expect, it } from "vitest";
import { cloneObjects, twinsOf } from "./copyObjects";
import type { ConnectorObject, Floor, MapObject } from "./venueMap";

const floors: Floor[] = [
  { id: "1F", name: "1F" },
  { id: "2F", name: "2F" },
  { id: "3F", name: "3F" },
];
const stairs = (floor: string): ConnectorObject => ({
  id: `s-${floor}`,
  kind: "place",
  floor,
  color: "room",
  x: 100,
  y: 100,
  shape: "rect",
  w: 60,
  h: 80,
  title: "階段",
  connector: "stairs",
  link: "L1",
  direction: "up",
});
const all: MapObject[] = [stairs("1F"), stairs("2F")];
const floorsOf = (objs: MapObject[]) => objs.map((o) => o.floor).sort();

describe("コピー・貼り付け・複製", () => {
  it("階段は、元と同じ階に分身を置き、新しい組になる（中身もそのまま）", () => {
    const items = [all[0]];
    const { shown, all: out } = cloneObjects(
      floors,
      items,
      twinsOf(all, items),
      "1F",
      24,
    );
    expect(shown).toHaveLength(1);
    expect(floorsOf(out)).toEqual(["1F", "2F"]);
    const links = new Set(out.map((o) => (o as ConnectorObject).link));
    expect(links.size).toBe(1);
    expect(links.has("L1")).toBe(false);
    expect(out.every((o) => (o as ConnectorObject).direction === "up")).toBe(
      true,
    );
    expect(shown[0]).toMatchObject({ x: 124, y: 124 });
  });
  it("別の階に貼ると、元の階はそのままで、貼った階が足される", () => {
    const items = [all[0]];
    const { all: out } = cloneObjects(
      floors,
      items,
      twinsOf(all, items),
      "3F",
      0,
    );
    expect(floorsOf(out)).toEqual(["1F", "2F", "3F"]);
  });
  it("階段でない物は、その物だけを写す", () => {
    const room: MapObject = {
      ...stairs("1F"),
      id: "r",
      connector: undefined,
      link: undefined,
    };
    const { all: out } = cloneObjects(
      floors,
      [room],
      twinsOf(all, [room]),
      "2F",
      0,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ floor: "2F", title: "階段" });
    expect(out[0].id).not.toBe("r");
  });
});
