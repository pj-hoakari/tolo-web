import { describe, expect, it } from "vitest";
import { graphDataSchema } from "@/features/graph/graphDataSchema";
import {
  isConnector,
  isDestination,
} from "@/features/guest/info/guideMapLayout";
import {
  isGroupNode,
  isPointNode,
} from "@/features/tenant/management/graph/type";
import {
  sampleGuestCrowd,
  sampleGuestQueues,
  sampleGuideMap,
  sampleGuideMapGraph,
} from "./guest";

const { graph, layout } = sampleGuideMap();
const pointIds = new Set(graph.points.map((p) => p.pointId));
const routeIds = new Set(graph.routes.map((r) => r.routeId));

describe("案内マップのフィクスチャ（KCG本館）", () => {
  it("グラフは保存時の規則を満たす", () => {
    expect(graphDataSchema.safeParse(sampleGuideMapGraph).success).toBe(true);
    const { nodes, edges } = sampleGuideMapGraph;
    const ids = [...nodes, ...edges].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    const seen = new Set<string>();
    for (const n of nodes) {
      if (n.parentId) {
        expect(seen.has(n.parentId)).toBe(true);
        expect(nodes.find((g) => g.id === n.parentId)?.type).toBe("graphGroup");
      }
      seen.add(n.id);
    }
    for (const e of edges) {
      expect(e.source).not.toBe(e.target);
      expect(
        nodes.find((n) => n.id === e.source && isPointNode(n)),
      ).toBeDefined();
      expect(
        nodes.find((n) => n.id === e.target && isPointNode(n)),
      ).toBeDefined();
    }
    for (const n of nodes.filter(isPointNode))
      expect(edges.some((e) => e.source === n.id || e.target === n.id)).toBe(
        true,
      );
    for (const g of nodes.filter(isGroupNode))
      expect(nodes.some((n) => n.parentId === g.id)).toBe(true);
  });

  it("グラフの ID はエディタが採番する形式（種類の接頭辞と 8 桁の 16 進）になっている", () => {
    for (const n of sampleGuideMapGraph.nodes)
      expect(n.id).toMatch(
        isGroupNode(n) ? /^g_[0-9a-f]{8}$/ : /^n_[0-9a-f]{8}$/,
      );
    for (const e of sampleGuideMapGraph.edges)
      expect(e.id).toMatch(/^e_[0-9a-f]{8}$/);
  });

  it("グラフのグループはレイアウトのフロアと同じ数だけある", () => {
    expect(sampleGuideMapGraph.nodes.filter(isGroupNode)).toHaveLength(
      layout.floors.length,
    );
  });

  it("目的地と階移動ポイントはすべてグラフのポイントに結び付いている", () => {
    for (const o of layout.objects.filter(
      (o) => isDestination(o) || isConnector(o),
    ))
      expect(o.graphPointId, o.title).toBeDefined();
  });

  it("レイアウトが参照するグラフ ID はすべてゲスト向けのグラフにある", () => {
    for (const o of layout.objects) {
      if (o.graphPointId) expect(pointIds).toContain(o.graphPointId);
      if (o.graphRouteId) expect(routeIds).toContain(o.graphRouteId);
    }
  });

  it("混雑状況のモックはゲスト向けのグラフにある ID を指す", () => {
    for (const { id } of sampleGuestCrowd("ja").crowd) {
      const [kind, value] = id.split(":");
      expect(kind === "pointId" ? pointIds : routeIds).toContain(value);
    }
  });

  it("行列のモックの入口はゲスト向けのグラフにあるポイントを指す", () => {
    for (const q of sampleGuestQueues("ja"))
      for (const g of q.gates) expect(pointIds).toContain(g.pointId);
  });
});
