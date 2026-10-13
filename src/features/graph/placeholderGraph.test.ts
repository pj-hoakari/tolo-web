import { describe, expect, it } from "vitest";
import {
  isExternalNode,
  isGroupNode,
} from "@/features/tenant/management/graph/type";
import { fetchGraph } from "./api";
import { PLACEHOLDER_GRAPH } from "./placeholderGraph";

const NODE_TYPES = ["GOAL", "GOAL_TRANSIT_MIXED", "TRANSIT_ONLY", "EXTERNAL"];

describe("PLACEHOLDER_GRAPH (placeholderGraph.json)", () => {
  it("ノードの type / nodeType / 親子関係が GraphData の制約を満たす", () => {
    const ids = new Set(PLACEHOLDER_GRAPH.nodes.map((n) => n.id));
    const seen = new Set<string>();
    for (const n of PLACEHOLDER_GRAPH.nodes) {
      expect(["graph", "graphGroup"]).toContain(n.type);
      if (!isExternalNode(n)) {
        expect(Object.keys(n.data.labels).length).toBeGreaterThan(0);
      }
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
    expect(
      PLACEHOLDER_GRAPH.nodes.filter(isExternalNode).length,
    ).toBeGreaterThan(0);
    for (const e of PLACEHOLDER_GRAPH.edges) {
      expect(e.type).toBe("graph");
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
      expect(["both", "oneway"]).toContain(e.data?.direction);
    }
  });

  it("fetchGraph はモック API からサンプルを受け取る", async () => {
    expect(await fetchGraph({ tenantId: "t", eventId: "e" })).toEqual(
      PLACEHOLDER_GRAPH,
    );
  });
});
