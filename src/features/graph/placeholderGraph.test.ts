import { describe, expect, it } from "vitest";
import { isGroupNode } from "@/features/tenant/management/graph/type";
import { fetchGraph } from "./api";
import { PLACEHOLDER_GRAPH } from "./placeholderGraph";

const NODE_TYPES = ["GOAL", "GOAL_TRANSIT_MIXED", "TRANSIT_ONLY", "BOUNDARY"];

describe("PLACEHOLDER_GRAPH (placeholderGraph.json)", () => {
  it("ノードの type / nodeType / 親子関係が GraphData の制約を満たす", () => {
    const ids = new Set(PLACEHOLDER_GRAPH.nodes.map((n) => n.id));
    const seen = new Set<string>();
    for (const n of PLACEHOLDER_GRAPH.nodes) {
      expect(["graph", "graphGroup"]).toContain(n.type);
      expect(Object.keys(n.data.labels).length).toBeGreaterThan(0);
      if (isGroupNode(n)) {
        expect(n.width).toBeGreaterThan(0);
        expect(n.height).toBeGreaterThan(0);
      } else {
        expect(NODE_TYPES).toContain(n.data.nodeType);
      }
      // React Flow の制約: 親グループは子より先に並ぶ
      if (n.parentId) expect(seen.has(n.parentId)).toBe(true);
      seen.add(n.id);
    }
    for (const e of PLACEHOLDER_GRAPH.edges) {
      expect(e.type).toBe("graph");
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
      expect(["both", "oneway"]).toContain(e.data?.direction);
    }
  });

  it("fetchGraph はサンプルの複製を返す", async () => {
    const a = await fetchGraph({ tenantId: "t", eventId: "e" });
    expect(a).toEqual(PLACEHOLDER_GRAPH);
    expect(a).not.toBe(PLACEHOLDER_GRAPH);
    expect(a.nodes[0]).not.toBe(PLACEHOLDER_GRAPH.nodes[0]);
  });
});
