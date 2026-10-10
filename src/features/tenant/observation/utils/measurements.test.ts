import { describe, expect, it } from "vitest";
import {
  buildWindowMeasurements,
  mapLinesToObservationPoints,
} from "./measurements";

const line = (id: string, name: string) => ({
  id,
  name,
  p1: { x: 0, y: 0 },
  p2: { x: 1, y: 0 },
});

describe("buildWindowMeasurements", () => {
  it("reports per observation point the crossings counted within the window", () => {
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
        a: { forward: 5, backward: 2 },
        b: { forward: 1, backward: 0 },
        c: { forward: 9, backward: 9 },
        d: { forward: 0, backward: 0 },
      },
      current: {
        a: { forward: 8, backward: 2 },
        b: { forward: 2, backward: 4 },
        c: { forward: 1, backward: 0 },
        d: { forward: 7, backward: 7 },
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
      },
      {
        observationPointId: "0000000000000002",
        windowStart,
        windowEnd,
        countIn: 1,
        countOut: 0,
      },
    ]);
  });
});
