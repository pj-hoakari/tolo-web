import { describe, expect, it } from "vitest";
import { PLACE_KINDS as TOLO_KINDS } from "@/features/guest/info/guideMapStyle";
import { sampleVenueDoc } from "./guideMapIO";
import {
  BASE_COLORS,
  DEFAULT_COLOR,
  type MapObject,
  markOf,
  normalizeDoc,
  PALETTE,
  PALETTE_GROUPS,
  PALETTE_KEYS,
  PLACE_KINDS,
  shownColorOf,
  type VenueMapDoc,
} from "./venueMap";

const place = (title: string, color: string): MapObject => ({
  id: "p",
  kind: "place",
  floor: "f",
  color,
  x: 0,
  y: 0,
  shape: "rect",
  w: 100,
  h: 100,
  title,
});

describe("色と種類（マーク）", () => {
  it("場所の種類は tolo-web と同じ", () => {
    expect([...PLACE_KINDS]).toEqual([...TOLO_KINDS]);
  });
  it("色えらびには基本の色が先頭に並び、どのキーにも色がある", () => {
    expect(PALETTE_KEYS.slice(0, BASE_COLORS.length)).toEqual([...BASE_COLORS]);
    expect(PALETTE_GROUPS.flatMap((g) => g.keys).sort()).toEqual(
      [...PALETTE_KEYS].sort(),
    );
    for (const k of PALETTE_KEYS) expect(PALETTE[k]).toBeDefined();
    expect(BASE_COLORS).toContain(DEFAULT_COLOR);
  });
  it("標準の色（slate・indigo）の場所は、名前から種類を推し量る（tolo-web と同じ）", () => {
    expect(shownColorOf(place("男子トイレ", "slate"))).toBe("toilet-men");
    expect(markOf(place("男子トイレ", "slate"))).toBe("toilet-men");
    expect(shownColorOf(place("401", "indigo"))).toBe("room");
  });
  it("基本の色を選んだ場所はその色のまま、マークは名前から決まる", () => {
    expect(shownColorOf(place("男子トイレ", "navy"))).toBe("navy");
    expect(markOf(place("男子トイレ", "navy"))).toBe("toilet-men");
    expect(shownColorOf(place("男子トイレ", "room"))).toBe("room");
    expect(markOf(place("男子トイレ", "room"))).toBe("room");
  });
  it("見本の地図は、範囲も含めてどの物も色えらびのどれかで選ばれて見える", async () => {
    const doc = await sampleVenueDoc();
    for (const o of doc.objects)
      expect(PALETTE_KEYS).toContain(shownColorOf(o));
  });
});

describe("読み込んだ地図をいまの形に直す", () => {
  const doc = (objects: object[]) =>
    ({
      version: 1,
      floors: [{ id: "f", name: "1F" }],
      activeFloorId: "f",
      objects,
      north: 0,
      scale: 0,
    }) as unknown as VenueMapDoc;
  it("古いマークの大きさ（markerSize）を markW / markH にし、写真（photo）は外す", () => {
    const d = normalizeDoc(
      doc([{ ...place("EV", "room"), markerSize: 40, photo: "data:x" }]),
    );
    expect(d.objects[0]).toMatchObject({ markW: 40, markH: 40 });
    expect(d.objects[0]).not.toHaveProperty("markerSize");
    expect(d.objects[0]).not.toHaveProperty("photo");
  });
  it("markW / markH があればそちらを使い、直す所が無ければそのまま返す", () => {
    expect(
      normalizeDoc(doc([{ ...place("EV", "room"), markerSize: 40, markW: 60 }]))
        .objects[0],
    ).toMatchObject({ markW: 60, markH: 40 });
    const same = doc([place("401", "room")]);
    expect(normalizeDoc(same)).toBe(same);
  });
  it("見本の地図には、古いマークの大きさが残っていない", async () => {
    const doc = await sampleVenueDoc();
    expect(doc.objects.some((o) => "markerSize" in o)).toBe(false);
  });
});
