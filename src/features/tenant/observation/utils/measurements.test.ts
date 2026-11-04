import { describe, expect, it } from "vitest";
import {
  buildWindowMeasurements,
  countPeopleByObservationPoint,
  mapLinesToObservationPoints,
} from "./measurements";

const line = (id: string, name: string) => ({
  id,
  name,
  p1: { x: 0, y: 0 },
  p2: { x: 1, y: 0 },
});

describe("buildWindowMeasurements", () => {
  it("同じカメラの 2 つの観測点には、それぞれに割り当てた人数の平均が入り、合計は画面全体の人数になる", () => {
    const windowStart = new Date("2026-10-10T00:00:00Z");
    const windowEnd = new Date("2026-10-10T00:00:30Z");
    const pointIdByLineId = mapLinesToObservationPoints(
      [
        line("a", "gate"),
        line("b", "gate"),
        line("c", "hall"),
        line("d", "unregistered"),
      ],
      new Map([
        ["gate", "0000000000000001"],
        ["hall", "0000000000000002"],
      ]),
    );

    const measurements = buildWindowMeasurements({
      pointIdByLineId,
      previous: {
        lineCounts: {
          a: { forward: 5, backward: 2 },
          b: { forward: 1, backward: 0 },
          c: { forward: 9, backward: 9 },
          d: { forward: 0, backward: 0 },
        },
        detectedPeople: {
          "0000000000000001": { frames: 10, people: 30 },
          "0000000000000002": { frames: 10, people: 10 },
        },
      },
      current: {
        lineCounts: {
          a: { forward: 8, backward: 2 },
          b: { forward: 2, backward: 4 },
          c: { forward: 1, backward: 0 },
          d: { forward: 7, backward: 7 },
        },
        detectedPeople: {
          "0000000000000001": { frames: 14, people: 38 },
          "0000000000000002": { frames: 14, people: 12 },
        },
      },
      windowStart,
      windowEnd,
    });

    expect(measurements).toEqual([
      {
        observationPointId: "0000000000000001",
        windowStart,
        windowEnd,
        countIn: 4,
        countOut: 4,
        meanDetectedPeople: 2,
      },
      {
        observationPointId: "0000000000000002",
        windowStart,
        windowEnd,
        countIn: 1,
        countOut: 0,
        meanDetectedPeople: 0.5,
      },
    ]);
  });

  it.each([
    ["検知フレームがない窓は欄を省く", { frames: 3, people: 6 }, undefined],
    ["誰もいなかった窓は 0 を送る", { frames: 5, people: 6 }, 0],
    [
      "集計がやり直された窓は戻った後の値で平均する",
      { frames: 2, people: 3 },
      1.5,
    ],
  ])("%s", (_label, current, expected) => {
    const [measurement] = buildWindowMeasurements({
      pointIdByLineId: new Map([["a", "0000000000000001"]]),
      previous: {
        lineCounts: {},
        detectedPeople: { "0000000000000001": { frames: 3, people: 6 } },
      },
      current: {
        lineCounts: {},
        detectedPeople: { "0000000000000001": current },
      },
      windowStart: new Date("2026-10-10T00:00:00Z"),
      windowEnd: new Date("2026-10-10T00:00:30Z"),
    });

    expect(measurement.meanDetectedPeople).toBe(expected);
    expect("meanDetectedPeople" in measurement).toBe(expected !== undefined);
  });
});

const segment = (x1: number, y1: number, x2: number, y2: number) => ({
  p1: { x: x1, y: y1 },
  p2: { x: x2, y: y2 },
});

describe("countPeopleByObservationPoint", () => {
  it("人はそれぞれ最も近いラインの観測点に数える", () => {
    const counts = countPeopleByObservationPoint(
      [
        { x: 10, y: 90 },
        { x: 50, y: 110 },
        { x: 30, y: 290 },
      ],
      new Map([
        ["gate", [segment(0, 100, 100, 100)]],
        ["hall", [segment(0, 300, 100, 300)]],
      ]),
    );

    expect(counts).toEqual(
      new Map([
        ["gate", 2],
        ["hall", 1],
      ]),
    );
  });

  it("同じ観測点のラインが複数あれば、そのうち最も近いラインまでの距離で比べる", () => {
    const counts = countPeopleByObservationPoint(
      [{ x: 50, y: 290 }],
      new Map([
        ["gate", [segment(0, 0, 100, 0), segment(0, 300, 100, 300)]],
        ["hall", [segment(0, 200, 100, 200)]],
      ]),
    );

    expect(counts).toEqual(
      new Map([
        ["gate", 1],
        ["hall", 0],
      ]),
    );
  });

  it("線分の端より外にいる人は端までの距離で比べる", () => {
    const counts = countPeopleByObservationPoint(
      [{ x: 300, y: 0 }],
      new Map([
        ["gate", [segment(0, 0, 100, 0)]],
        ["hall", [segment(250, 100, 250, 200)]],
      ]),
    );

    expect(counts).toEqual(
      new Map([
        ["gate", 0],
        ["hall", 1],
      ]),
    );
  });

  it("観測点が 1 つなら、どこにいる人もその観測点に数える", () => {
    const counts = countPeopleByObservationPoint(
      [
        { x: 0, y: 0 },
        { x: 1000, y: 1000 },
      ],
      new Map([["gate", [segment(0, 500, 100, 500)]]]),
    );

    expect(counts).toEqual(new Map([["gate", 2]]));
  });

  it("観測点がなければ誰も数えない", () => {
    expect(countPeopleByObservationPoint([{ x: 0, y: 0 }], new Map())).toEqual(
      new Map(),
    );
  });
});
