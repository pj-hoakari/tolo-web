import { describe, expect, it } from "vitest";
import { toOverlayCountingLines } from "@/features/tenant/webrtc/utils/detectionOverlay";
import {
  countPeopleInAreas,
  findOverlappingAreaNames,
  isInsideArea,
  lineArea,
  observationPointAreas,
} from "./observationAreas";

const POINT_IDS: Record<string, string> = { gate: "1", hall: "2" };

const line = (
  name: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  areaWidth = 20,
  observationPointId: string | null = POINT_IDS[name] ?? null,
) => ({
  name,
  observationPointId,
  p1: { x: x1, y: y1 },
  p2: { x: x2, y: y2 },
  areaWidth,
});

const countIn = (
  people: { x: number; y: number }[],
  lines: ReturnType<typeof line>[],
  knownPointIds: string[],
) =>
  countPeopleInAreas(
    people,
    observationPointAreas(lines, new Set(knownPointIds)),
  );

describe("ラインのエリア", () => {
  it("ラインを中心に幅の半分ずつ両側へ広げ、端より先には広げない", () => {
    const area = lineArea(line("gate", 0, 100, 100, 100));

    expect(isInsideArea({ x: 50, y: 91 }, area)).toBe(true);
    expect(isInsideArea({ x: 50, y: 109 }, area)).toBe(true);
    expect(isInsideArea({ x: 50, y: 111 }, area)).toBe(false);
    expect(isInsideArea({ x: 101, y: 100 }, area)).toBe(false);
  });

  it("長さのないラインはエリアを持たない", () => {
    expect(lineArea(line("gate", 5, 5, 5, 5))).toEqual([]);
  });

  it.each([
    [1600, 900],
    [900, 1600],
  ])(
    "%d×%d の映像でも、斜めのラインのエリアの幅は短辺に対する割合のピクセルで一定",
    (width, height) => {
      const [pixelLine] = toOverlayCountingLines(
        [
          {
            id: "a",
            name: "gate",
            observationPointId: null,
            p1: { x: 0, y: 0 },
            p2: { x: 1, y: 1 },
            areaWidth: 0.1,
          },
        ],
        width,
        height,
      );
      const area = lineArea(pixelLine);
      const length = Math.hypot(width, height);
      const normal = { x: -height / length, y: width / length };
      const at = (distance: number) => ({
        x: width / 2 + normal.x * distance,
        y: height / 2 + normal.y * distance,
      });

      expect(pixelLine.areaWidth).toBe(90);
      expect(isInsideArea(at(44), area)).toBe(true);
      expect(isInsideArea(at(-44), area)).toBe(true);
      expect(isInsideArea(at(46), area)).toBe(false);
      expect(isInsideArea(at(-46), area)).toBe(false);
    },
  );
});

describe("観測点ごとの人数", () => {
  it("足元がどの観測点のエリアにも入らない人は数えない", () => {
    expect(
      countIn(
        [
          { x: 50, y: 100 },
          { x: 50, y: 300 },
          { x: 50, y: 200 },
        ],
        [line("gate", 0, 100, 100, 100), line("hall", 0, 300, 100, 300)],
        ["1", "2"],
      ),
    ).toEqual(
      new Map([
        ["1", 1],
        ["2", 1],
      ]),
    );
  });

  it("観測点が 1 つでも、エリアの外にいる人は数えない", () => {
    expect(
      countIn(
        [
          { x: 50, y: 100 },
          { x: 1000, y: 1000 },
        ],
        [line("gate", 0, 100, 100, 100)],
        ["1"],
      ),
    ).toEqual(new Map([["1", 1]]));
  });

  it("同じ観測点の 2 本のラインのエリアが重なっていても、重なりにいる人は 1 回だけ数える", () => {
    expect(
      countIn(
        [{ x: 50, y: 100 }],
        [line("gate", 0, 100, 100, 100), line("gate", 50, 50, 50, 150)],
        ["1"],
      ),
    ).toEqual(new Map([["1", 1]]));
  });

  it("違う観測点のエリアが重なっていれば、重なりにいる人は両方の観測点に数える", () => {
    expect(
      countIn(
        [{ x: 50, y: 100 }],
        [line("gate", 0, 100, 100, 100), line("hall", 50, 50, 50, 150)],
        ["1", "2"],
      ),
    ).toEqual(
      new Map([
        ["1", 1],
        ["2", 1],
      ]),
    );
  });

  it("観測点を割り当てていないラインは、観測点と同じ名前でも数えない", () => {
    expect(
      countIn(
        [{ x: 50, y: 100 }],
        [line("gate", 0, 100, 100, 100, 20, null)],
        ["1"],
      ),
    ).toEqual(new Map());
  });

  it("端末の観測点にない ID を割り当てたラインは数えない", () => {
    expect(
      countIn(
        [{ x: 50, y: 100 }],
        [line("gate", 0, 100, 100, 100, 20, "9")],
        ["1"],
      ),
    ).toEqual(new Map());
  });
});

describe("エリアの重なり", () => {
  it("違う観測点のラインのエリアが重なれば、そのラインの名前の組を返す", () => {
    expect(
      findOverlappingAreaNames([
        line("gate", 0, 100, 100, 100),
        line("hall", 50, 50, 50, 150),
      ]),
    ).toEqual([["gate", "hall"]]);
  });

  it("ライン自体が交わらなくても、エリアが重なれば返す", () => {
    expect(
      findOverlappingAreaNames([
        line("gate", 0, 100, 100, 100),
        line("hall", 0, 115, 100, 115),
      ]),
    ).toEqual([["gate", "hall"]]);
  });

  it("エリアが離れていれば返さない", () => {
    expect(
      findOverlappingAreaNames([
        line("gate", 0, 100, 100, 100),
        line("hall", 0, 125, 100, 125),
      ]),
    ).toEqual([]);
  });

  it("同じ観測点のラインどうしや、観測点を割り当てていないラインとの重なりは返さない", () => {
    expect(
      findOverlappingAreaNames([
        line("gate", 0, 100, 100, 100),
        line("gate", 50, 50, 50, 150),
        line("", 0, 100, 100, 100),
      ]),
    ).toEqual([]);
  });

  it("同じ名前の組は 1 回だけ返す", () => {
    expect(
      findOverlappingAreaNames([
        line("gate", 0, 100, 100, 100),
        line("hall", 50, 50, 50, 150),
        line("hall", 0, 105, 100, 105),
      ]),
    ).toEqual([["gate", "hall"]]);
  });
});
