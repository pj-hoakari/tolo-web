import { describe, expect, it } from "vitest";
import { niceSnapPoints, snapRadius, snapToPoints } from "./sliderSnap";

describe("スライダーの切りのいい数字", () => {
  it("範囲に合わせて、切りのいい目盛りを作る", () => {
    expect(niceSnapPoints(50, 200)).toEqual([60, 80, 100, 120, 140, 160, 180]);
    expect(niceSnapPoints(20, 1500)).toEqual([
      200, 400, 600, 800, 1000, 1200, 1400,
    ]);
    expect(niceSnapPoints(8, 72)).toEqual([10, 20, 30, 40, 50, 60, 70]);
  });

  it("目盛りの近くなら吸い付き、離れていればそのまま", () => {
    const points = [100, 200];
    expect(snapToPoints(103, points, 5)).toBe(100);
    expect(snapToPoints(196, points, 5)).toBe(200);
    expect(snapToPoints(150, points, 5)).toBe(150);
  });

  it("吸い付く幅は範囲の 2.5%（少なくとも刻みの 1.5 倍）", () => {
    expect(snapRadius(0, 1000)).toBe(25);
    expect(snapRadius(0, 10)).toBe(1.5);
    expect(snapRadius(50, 200, 5)).toBe(7.5);
  });
});
