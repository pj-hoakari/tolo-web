import { describe, expect, it } from "vitest";
import { smartSnap } from "./guideMapSnap";

const box = { l: 0, t: 0, r: 40, b: 40 };

describe("smartSnap", () => {
  it("ほかの物が近くに無ければ、グリッドの刻みにそろえる", () => {
    const r = smartSnap(box, [], 27, 13, 10, 20);
    expect([r.dx, r.dy]).toEqual([20, 20]);
  });

  it("刻みを 0 にすると、そろえずにそのまま動かす（Alt を押して好きな位置に置くとき）", () => {
    const r = smartSnap(box, [], 27, 13, 10, 0);
    expect([r.dx, r.dy]).toEqual([27, 13]);
  });
});
