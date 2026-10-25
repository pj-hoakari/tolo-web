import { describe, expect, it } from "vitest";
import { computeFloorRoute, type FloorRouteStep } from "./guideMapFloorRoute";
import {
  type CrowdState,
  crowdByObject,
  type GuideMapLayout,
  type MapObject,
  type PlaceObject,
  type Pt,
} from "./guideMapLayout";
import guideMapLayoutFixture from "./guideMapLayoutFixture.json";
import { computeRoute } from "./guideMapRoute";

// テスト用に固定した案内マップ（guide-map-poc の旧見本：イベント会場 1F・2F）。
// 表示用の mocks/fixtures/guideMapLayout.json は差し替わるので、テストはこちらを使う
const doc = guideMapLayoutFixture as unknown as GuideMapLayout;

const place = (id: string) =>
  doc.objects.find((o) => o.id === id) as PlaceObject;

const steps = (result: ReturnType<typeof computeFloorRoute>) => {
  if (!("steps" in result)) throw new Error(`route failed: ${result.error}`);
  return result.steps;
};

/** 折れ線上の点を細かくたどり、矩形の内側に入る点があるか */
function crossesRect(points: Pt[], r: PlaceObject) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    for (let t = 0; t <= 1; t += 0.02) {
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      if (Math.abs(x - r.x) < r.w / 2 && Math.abs(y - r.y) < r.h / 2)
        return true;
    }
  }
  return false;
}

/** 2 フロアを上りのみのエスカレーター 1 本だけでつないだ会場 */
function escalatorOnlyDoc(): GuideMapLayout {
  const room = (id: string, floor: string, x: number): PlaceObject => ({
    id,
    kind: "place",
    floor,
    color: "sky",
    shape: "pin",
    x,
    y: 400,
    w: 0,
    h: 0,
    title: id,
  });
  const escalator = (floor: string): PlaceObject => ({
    id: `esc-${floor}`,
    kind: "place",
    floor,
    color: "slate",
    shape: "pin",
    x: 600,
    y: 400,
    w: 0,
    h: 0,
    connector: "escalator",
    link: "l-esc",
    direction: "up",
  });
  return {
    version: 1,
    floors: [
      { id: "low", name: "1F" },
      { id: "high", name: "2F" },
    ],
    activeFloorId: "low",
    north: 0,
    scale: 0,
    objects: [
      room("a", "low", 200),
      room("b", "high", 1000),
      escalator("low"),
      escalator("high"),
    ],
  };
}

describe("computeRoute（1 フロア内）", () => {
  const floor1 = doc.objects.filter((o) => o.floor === "f-1");

  it("出発から目的地までの点列を返し、始点と終点は指定どおり", () => {
    const gate = place("p-gate");
    const goods = place("r-goods");
    const pts = computeRoute(floor1, gate, goods, 1200, 800);

    expect(pts).not.toBeNull();
    expect(pts?.[0]).toMatchObject({ x: gate.x, y: gate.y });
    expect(pts?.at(-1)).toMatchObject({ x: goods.x, y: goods.y });
  });

  it("目的地以外の部屋（壁）の中は通らない", () => {
    const pts =
      computeRoute(floor1, place("p-gate"), place("r-goods"), 1200, 800) ?? [];
    const walls = floor1.filter(
      (o): o is PlaceObject =>
        o.kind === "place" && o.shape === "rect" && o.id !== "r-goods",
    );

    expect(pts.length).toBeGreaterThan(1);
    expect(walls.length).toBeGreaterThan(0);
    for (const wall of walls) expect(crossesRect(pts, wall)).toBe(false);
  });

  it("経路線は縦横だけの直角な線になる", () => {
    const pts =
      computeRoute(floor1, place("p-gate"), place("r-goods"), 1200, 800) ?? [];

    expect(pts.length).toBeGreaterThan(2);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      expect(Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5).toBe(true);
    }
  });

  it("出発と目的地が同じ建物の中なら、建物の外には出ない", () => {
    const building = doc.objects.find((o) => o.id === "a-building-1");
    if (building?.kind !== "area") throw new Error("building not found");
    const pts =
      computeRoute(floor1, place("p-gate"), place("r-cafe"), 1200, 800) ?? [];
    const box = {
      minX: Math.min(...building.points.map((p) => p.x)),
      maxX: Math.max(...building.points.map((p) => p.x)),
      minY: Math.min(...building.points.map((p) => p.y)),
      maxY: Math.max(...building.points.map((p) => p.y)),
    };

    expect(pts.length).toBeGreaterThan(1);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(box.minX);
      expect(p.x).toBeLessThanOrEqual(box.maxX);
      expect(p.y).toBeGreaterThanOrEqual(box.minY);
      expect(p.y).toBeLessThanOrEqual(box.maxY);
    }
  });

  it("キャンバスの既定の広さより外に置いた場所にも道なりで行ける", () => {
    const goal = { x: 1500, y: 500 };
    const pts = computeRoute([], { x: 600, y: 300 }, goal, 1200, 800);

    expect(pts?.at(-1)).toMatchObject(goal);
  });

  it("目的地を壁で完全に囲うと到達できず null を返す", () => {
    const wall = (id: string, x: number, y: number, w: number, h: number) =>
      ({
        id,
        kind: "place",
        floor: "x",
        color: "slate",
        shape: "rect",
        x,
        y,
        w,
        h,
      }) satisfies MapObject;
    const box = [
      wall("w1", 600, 300, 300, 40),
      wall("w2", 600, 500, 300, 40),
      wall("w3", 470, 400, 40, 240),
      wall("w4", 730, 400, 40, 240),
    ];

    expect(
      computeRoute(box, { x: 100, y: 100 }, { x: 600, y: 400 }, 1200, 800),
    ).toBeNull();
  });
});

describe("computeFloorRoute（フロアをまたぐ）", () => {
  it("同じ階なら歩く区間 1 つだけ", () => {
    const result = steps(computeFloorRoute(doc, "p-gate", "r-cafe"));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: "walk",
      floor: "f-1",
      fromId: "p-gate",
      toId: "r-cafe",
    });
  });

  it("同じ階の目的地へは、階段やエレベーターを近道として素通りしない", () => {
    for (const goal of ["r-goods", "r-cafe", "r-reception", "r-toilet"]) {
      const result = steps(computeFloorRoute(doc, "p-gate", goal));

      expect(result.map((s) => s.kind)).toEqual(["walk"]);
      expect(result[0]).toMatchObject({ fromId: "p-gate", toId: goal });
    }
  });

  it("別の階なら階移動手段で乗り換え、目的地の階を歩いて着く", () => {
    const result = steps(computeFloorRoute(doc, "p-gate", "r2-hall"));
    const ride = result.find(
      (s): s is Extract<FloorRouteStep, { kind: "ride" }> => s.kind === "ride",
    );

    expect(result[0]).toMatchObject({ kind: "walk", floor: "f-1" });
    expect(ride).toMatchObject({ fromFloor: "f-1", toFloor: "f-2" });
    expect(["stairs", "elevator"]).toContain(ride?.via);
    expect(result.at(-1)).toMatchObject({
      kind: "walk",
      floor: "f-2",
      toId: "r2-hall",
    });
  });

  it("上りのみのエスカレーターは上りに使え、下りには使わない", () => {
    const layout = escalatorOnlyDoc();

    expect(
      steps(computeFloorRoute(layout, "a", "b")).map((s) => s.kind),
    ).toEqual(["walk", "ride", "walk"]);
    expect(computeFloorRoute(layout, "b", "a")).toEqual({
      error: "unreachable",
    });
  });

  it("出発階から別の階へ行ける階移動手段が無ければ no-connector", () => {
    const noConnector: GuideMapLayout = {
      ...doc,
      objects: doc.objects.filter((o) => !(o.kind === "place" && o.connector)),
    };

    expect(computeFloorRoute(noConnector, "p-gate", "r2-hall")).toEqual({
      error: "no-connector",
    });
  });

  it("存在しない場所を指定すると unreachable", () => {
    expect(computeFloorRoute(doc, "p-gate", "nope")).toEqual({
      error: "unreachable",
    });
  });
});

describe("混雑回避ルート", () => {
  const danger: CrowdState = { level: "high", danger: true };
  const rideOf = (result: ReturnType<typeof computeFloorRoute>) =>
    steps(result).find(
      (s): s is Extract<FloorRouteStep, { kind: "ride" }> => s.kind === "ride",
    );

  it("混雑状況をグラフ ID で地図のオブジェクトに引き直す（1 つの ID に複数のオブジェクト）", () => {
    const objects: MapObject[] = [
      { ...place("c-ev-f-1"), pointId: "ev" },
      { ...place("c-ev-f-2"), pointId: "ev" },
      {
        id: "corridor",
        kind: "area",
        floor: "f-1",
        color: "slate",
        points: [],
        routeId: "e1",
      },
      place("r-cafe"),
    ];
    const crowd = crowdByObject(objects, [
      { id: "pointId:ev", level: "high", danger: true },
      { id: "routeId:e1", level: "mid", danger: false },
      { id: "pointId:unknown", level: "high", danger: false },
    ]);

    expect([...crowd.keys()].sort()).toEqual([
      "c-ev-f-1",
      "c-ev-f-2",
      "corridor",
    ]);
    expect(crowd.get("corridor")).toEqual({ level: "mid", danger: false });
  });

  it("危険なエレベーターは使わず、階段で別の階へ行く", () => {
    const crowd = new Map([
      ["c-ev-f-1", danger],
      ["c-ev-f-2", danger],
    ]);
    const result = computeFloorRoute(doc, "p-gate", "r2-hall", { crowd });

    expect(rideOf(result)?.via).toBe("stairs");
    expect("throughDanger" in result && result.throughDanger).toBeFalsy();
  });

  it("危険な階段は使わず、エレベーターで別の階へ行く", () => {
    const crowd = new Map([
      ["c-stairs-f-1", danger],
      ["c-stairs-f-2", danger],
    ]);

    expect(
      rideOf(computeFloorRoute(doc, "p-gate", "r2-hall", { crowd }))?.via,
    ).toBe("elevator");
  });

  it("どの階移動手段も危険なら、危険を通る道にして throughDanger を立てる", () => {
    const crowd = new Map(
      ["c-ev-f-1", "c-ev-f-2", "c-stairs-f-1", "c-stairs-f-2"].map((id) => [
        id,
        danger,
      ]),
    );
    const result = computeFloorRoute(doc, "p-gate", "r2-hall", { crowd });

    expect(steps(result).at(-1)).toMatchObject({ toId: "r2-hall" });
    expect("throughDanger" in result && result.throughDanger).toBe(true);
  });

  it("危険なエリアの中は通らず、混雑が無ければその中を通る", () => {
    const zone: MapObject = {
      id: "zone",
      kind: "area",
      floor: "x",
      color: "rose",
      points: [
        { x: 500, y: 0 },
        { x: 700, y: 0 },
        { x: 700, y: 640 },
        { x: 500, y: 640 },
      ],
    };
    const start = { x: 200, y: 300 };
    const goal = { x: 1000, y: 300 };
    const inZone = (pts: Pt[]) =>
      pts.some((p, i) => {
        if (i === 0) return false;
        const a = pts[i - 1];
        for (let t = 0; t <= 1; t += 0.02) {
          const x = a.x + (p.x - a.x) * t;
          const y = a.y + (p.y - a.y) * t;
          if (x > 500 && x < 700 && y < 640) return true;
        }
        return false;
      });

    const plain = computeRoute([zone], start, goal, 1200, 800) ?? [];
    const avoided =
      computeRoute([zone], start, goal, 1200, 800, {
        crowd: new Map([["zone", danger]]),
      }) ?? [];

    expect(inZone(plain)).toBe(true);
    expect(avoided.length).toBeGreaterThan(1);
    expect(inZone(avoided)).toBe(false);
  });
});
