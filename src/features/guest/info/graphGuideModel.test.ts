import { describe, expect, it } from "vitest";
import { PLACEHOLDER_GRAPH } from "@/features/graph";
import { buildGuideGraph } from "./graphGuideModel";

describe("buildGuideGraph", () => {
  it("フロア・地点・エッジ・ゴールをサンプルグラフから組み立てる", () => {
    const model = buildGuideGraph(PLACEHOLDER_GRAPH, "ja");

    // グループ 2 枚（1F / 2F）がフロアになる
    expect(model.floors).toHaveLength(2);
    // 地点は graph ノード（= 全ノード - グループ）
    const pointNodeCount = PLACEHOLDER_GRAPH.nodes.filter(
      (n) => n.type !== "graphGroup",
    ).length;
    expect(model.points).toHaveLength(pointNodeCount);
    expect(model.edges).toHaveLength(PLACEHOLDER_GRAPH.edges.length);
  });

  it("地点座標を所属フロアの左上ぶんだけ絶対座標へ直す", () => {
    const model = buildGuideGraph(PLACEHOLDER_GRAPH, "ja");
    // ph_entrance は floor1(y=320) の (120,240) → 絶対 (120,560)
    const entrance = model.points.find((p) => p.id === "ph_entrance");
    expect(entrance).toBeDefined();
    expect(entrance?.x).toBe(120);
    expect(entrance?.y).toBe(560);
  });

  it("GOAL / GOAL_TRANSIT_MIXED だけを目的地候補にする", () => {
    const model = buildGuideGraph(PLACEHOLDER_GRAPH, "ja");
    const goalIds = model.goals.map((g) => g.id).sort();
    expect(goalIds).toEqual(["ph_booth", "ph_gallery2f", "ph_wall"].sort());
  });

  it("現在地は入口（エッジの source になる BOUNDARY）を選ぶ", () => {
    const model = buildGuideGraph(PLACEHOLDER_GRAPH, "ja");
    expect(model.start).toBe("ph_entrance");
  });

  it("表示ロケールでラベルを解決する（en）", () => {
    const model = buildGuideGraph(PLACEHOLDER_GRAPH, "en");
    const booth = model.points.find((p) => p.id === "ph_booth");
    expect(booth?.label).toBe("Booth A");
  });
});
