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
  sampleQrLocations,
} from "./guest";

const { graph, layout } = sampleGuideMap();
const pointIds = new Set(graph.points.map((p) => p.pointId));
const routeIds = new Set(sampleGuideMapGraph.edges.map((e) => e.id));

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

  it("レイアウトの階はすべてグラフのグループで、日本語と英語のラベルがある", () => {
    expect(graph.groups.map((g) => g.groupId).sort()).toEqual(
      layout.groups.map((g) => g.groupId).sort(),
    );
    for (const g of graph.groups) {
      expect(g.labels.ja, g.groupId).toBeTruthy();
      expect(g.labels.en, g.groupId).toBeTruthy();
    }
  });

  it("レイアウトのオブジェクトはすべてレイアウトにある階に置かれている", () => {
    const groupIds = new Set(layout.groups.map((g) => g.groupId));
    for (const o of layout.objects) expect(groupIds).toContain(o.groupId);
  });

  it("ゲスト向けのグラフにはレイアウトが参照するポイントだけがある", () => {
    const referenced = new Set(layout.objects.map((o) => o.pointId));
    for (const p of graph.points) expect(referenced).toContain(p.pointId);
  });

  it("目的地と階移動手段はすべてグラフのポイントに結び付いている", () => {
    for (const o of layout.objects.filter(
      (o) => isDestination(o) || isConnector(o),
    ))
      expect(o.pointId, o.title).toBeDefined();
  });

  it("レイアウトが参照するポイント ID はゲスト向けのグラフに、ルート ID は管理側のグラフにある", () => {
    for (const o of layout.objects) {
      if (o.pointId) expect(pointIds).toContain(o.pointId);
      if (o.routeId) expect(routeIds).toContain(o.routeId);
    }
  });

  it("混雑状況のモックはグラフにある ID を指す", () => {
    for (const { id } of sampleGuestCrowd("ja").crowd) {
      const [kind, value] = id.split(":");
      expect(
        kind === "pointId"
          ? sampleGuideMapGraph.nodes.filter(isPointNode).map((n) => n.id)
          : [...routeIds],
      ).toContain(value);
    }
  });

  it("行列のモックの入口はゲスト向けのグラフにあるポイントを指す", () => {
    for (const q of sampleGuestQueues("ja"))
      for (const g of q.gates) expect(pointIds).toContain(g.pointId);
  });

  it("QR の設置箇所 ID はサーバーが採番する 16 桁の 16 進で、グラフのポイントかルートを指す", () => {
    const graphIds = new Set(sampleGuideMapGraph.nodes.map((n) => n.id));
    for (const [qrLocationId, anchor] of sampleQrLocations) {
      expect(qrLocationId).toMatch(/^[0-9a-f]{16}$/);
      if ("pointId" in anchor) expect(graphIds).toContain(anchor.pointId);
      else expect(routeIds).toContain(anchor.routeId);
    }
  });

  it("4F の QR から開くと現在地は 4F の場所に結び付いたポイントになる", () => {
    const { currentPointId } = sampleGuideMap("a84d0e6c2b9f1735");
    const place = layout.objects.find(
      (o) => o.kind === "place" && o.pointId === currentPointId,
    );
    expect(
      graph.groups.find((g) => g.groupId === place?.groupId)?.labels.ja,
    ).toBe("4F");
  });

  it("ルートを指す QR、レイアウトが参照しないポイントを指す QR、登録のない QR、QR なしでは現在地を返さない", () => {
    for (const qrLocationId of [
      "5b2e8d0f4c7a1936",
      "c9d47e1a03b65f28",
      "gate-east",
      "",
      undefined,
    ])
      expect(sampleGuideMap(qrLocationId)).not.toHaveProperty("currentPointId");
  });
});
