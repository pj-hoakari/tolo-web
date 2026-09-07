import { describe, expect, it } from "vitest";
import type { GuideEdge } from "./graphGuideModel";
import { findPath, routeSegmentKeys } from "./graphGuideRoute";

// a →(oneway) b ↔(both) c ↔(both) d、および b ↔ e（袋小路）
const edges: GuideEdge[] = [
  { id: "e1", from: "a", to: "b", direction: "oneway" },
  { id: "e2", from: "b", to: "c", direction: "both" },
  { id: "e3", from: "c", to: "d", direction: "both" },
  { id: "e4", from: "b", to: "e", direction: "both" },
];

describe("findPath", () => {
  it("start === goal なら 1 点のみ返す", () => {
    expect(findPath(edges, "a", "a")).toEqual(["a"]);
  });

  it("最短ホップの経路を返す", () => {
    expect(findPath(edges, "a", "d")).toEqual(["a", "b", "c", "d"]);
  });

  it("both エッジは逆向きにもたどれる", () => {
    expect(findPath(edges, "d", "b")).toEqual(["d", "c", "b"]);
  });

  it("oneway を逆走できず、到達不能なら空配列", () => {
    // a→b は oneway。b から a へは戻れない
    expect(findPath(edges, "b", "a")).toEqual([]);
  });

  it("孤立ノードへは到達できない", () => {
    expect(findPath(edges, "a", "zzz")).toEqual([]);
  });
});

describe("routeSegmentKeys", () => {
  it("隣接ペアを両向きで集合化する", () => {
    const keys = routeSegmentKeys(["a", "b", "c"]);
    expect(keys.has("a\tb")).toBe(true);
    expect(keys.has("b\ta")).toBe(true);
    expect(keys.has("b\tc")).toBe(true);
    expect(keys.has("a\tc")).toBe(false);
  });

  it("空・単一ノードでは空集合", () => {
    expect(routeSegmentKeys([]).size).toBe(0);
    expect(routeSegmentKeys(["a"]).size).toBe(0);
  });
});
