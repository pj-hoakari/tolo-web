import { describe, expect, it } from "vitest";
import { PLACEHOLDER_GRAPH } from "../placeholderGraph";
import type {
  GraphCanvasNode,
  GraphEdgeType,
  GraphNodeType,
  GroupNodeType,
} from "../type";
import { isGroupNode } from "../type";
import { autoAlignGraph } from "./autoLayout";
import { absolutePositionOf, fitGroupsToChildren } from "./groups";

function point(
  id: string,
  x: number,
  y: number,
  parentId?: string,
): GraphNodeType {
  return {
    id,
    type: "graph",
    position: { x, y },
    ...(parentId ? { parentId } : {}),
    data: { label: id, nodeType: "GOAL_TRANSIT_MIXED" },
  };
}

function group(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  parentId?: string,
): GroupNodeType {
  return {
    id,
    type: "graphGroup",
    position: { x, y },
    width,
    height,
    ...(parentId ? { parentId } : {}),
    data: { label: id },
  };
}

function edge(id: string, source: string, target: string): GraphEdgeType {
  return { id, source, target, type: "graph", data: { direction: "both" } };
}

/** ポイントの絶対中心（position = 中心アンカー） */
function centerOf(nodes: GraphCanvasNode[], id: string) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const node = byId.get(id);
  if (!node) throw new Error(`node not found: ${id}`);
  return absolutePositionOf(node, byId);
}

function groupOf(nodes: GraphCanvasNode[], id: string): GroupNodeType {
  const node = nodes.find((n) => n.id === id);
  if (!node || !isGroupNode(node)) throw new Error(`group not found: ${id}`);
  return node;
}

describe("autoAlignGraph: 接続に沿った整列", () => {
  it("横に広がる配置なら、接続順に左から右へ並び縦位置が揃う", () => {
    // 全体としては左→右だが、位置はばらばらに置く
    const nodes = [
      point("a", 0, 300),
      point("b", 300, 150),
      point("c", 600, 0),
    ];
    const edges = [edge("e1", "a", "b"), edge("e2", "b", "c")];

    const aligned = autoAlignGraph(nodes, edges);

    const a = centerOf(aligned, "a");
    const b = centerOf(aligned, "b");
    const c = centerOf(aligned, "c");
    expect(a.x).toBeLessThan(b.x);
    expect(b.x).toBeLessThan(c.x);
    expect(a.y).toBe(b.y);
    expect(b.y).toBe(c.y);
  });

  it("縦に広がる配置なら向きを尊重し、上から下へ並び横位置が揃う", () => {
    const nodes = [point("a", 0, 0), point("b", 50, 200), point("c", 0, 400)];
    const edges = [edge("e1", "a", "b"), edge("e2", "b", "c")];

    const aligned = autoAlignGraph(nodes, edges);

    const a = centerOf(aligned, "a");
    const b = centerOf(aligned, "b");
    const c = centerOf(aligned, "c");
    expect(a.y).toBeLessThan(b.y);
    expect(b.y).toBeLessThan(c.y);
    expect(a.x).toBe(b.x);
    expect(b.x).toBe(c.x);
  });

  it("右から左へ流れる配置なら、その向きのまま整列する", () => {
    const nodes = [point("a", 600, 0), point("b", 300, 50), point("c", 0, 0)];
    const edges = [edge("e1", "a", "b"), edge("e2", "b", "c")];

    const aligned = autoAlignGraph(nodes, edges);

    const a = centerOf(aligned, "a");
    const b = centerOf(aligned, "b");
    const c = centerOf(aligned, "c");
    expect(a.x).toBeGreaterThan(b.x);
    expect(b.x).toBeGreaterThan(c.x);
    expect(a.y).toBe(b.y);
    expect(b.y).toBe(c.y);
  });

  it("分岐先は同じ列に縦へ積まれ、分岐元はその中間に揃う", () => {
    const nodes = [
      point("a", 0, 0),
      point("b", 400, 100),
      point("c", 350, 300),
    ];
    const edges = [edge("e1", "a", "b"), edge("e2", "a", "c")];

    const aligned = autoAlignGraph(nodes, edges);

    const a = centerOf(aligned, "a");
    const b = centerOf(aligned, "b");
    const c = centerOf(aligned, "c");
    expect(b.x).toBe(c.x);
    expect(b.y).not.toBe(c.y);
    expect(a.x).toBeLessThan(b.x);
    expect(a.y).toBeCloseTo((b.y + c.y) / 2);
  });

  it("ルートで繋がっていないノードは別の塊として離して積まれる", () => {
    const nodes = [point("a", 0, 0), point("b", 300, 0), point("z", 600, 0)];
    const edges = [edge("e1", "a", "b")];

    const aligned = autoAlignGraph(nodes, edges);

    const a = centerOf(aligned, "a");
    const b = centerOf(aligned, "b");
    const z = centerOf(aligned, "z");
    expect(z.y).toBeGreaterThan(Math.max(a.y, b.y));
  });

  it("同じ入力からは常に同じ結果になる", () => {
    const nodes = [
      group("g1", 0, 0, 480, 320),
      point("a", 100, 100, "g1"),
      point("b", 300, 200, "g1"),
      point("c", 700, 100),
    ];
    const edges = [edge("e1", "a", "b"), edge("e2", "b", "c")];

    expect(autoAlignGraph(nodes, edges)).toEqual(autoAlignGraph(nodes, edges));
  });
});

describe("autoAlignGraph: グループをまたぐルート（横並び）", () => {
  // g1 (p1 → p2) と g2 (p3 → p4) が横に並び、p2 → p3 のルートでつながる。
  // グループ内の並びは接続順と逆（かつ縦ずれ）に置く。
  const crossGraph = () => ({
    nodes: [
      group("g1", 0, 0, 480, 320),
      group("g2", 600, 0, 480, 320),
      point("p1", 300, 200, "g1"),
      point("p2", 100, 100, "g1"),
      point("p3", 300, 100, "g2"),
      point("p4", 100, 200, "g2"),
    ],
    edges: [
      edge("e1", "p1", "p2"),
      edge("e2", "p2", "p3"),
      edge("e3", "p3", "p4"),
    ],
  });

  it("横並びを尊重してグループが左右に並ぶ", () => {
    const { nodes, edges } = crossGraph();
    const aligned = autoAlignGraph(nodes, edges);

    const g1 = groupOf(aligned, "g1");
    const g2 = groupOf(aligned, "g2");
    // 重ならず、g1 が左・g2 が右のまま
    expect(g1.position.x + (g1.width ?? 0)).toBeLessThan(g2.position.x);
  });

  it("またぐルートの端点はグループの相手側の列に配置される", () => {
    const { nodes, edges } = crossGraph();
    const aligned = autoAlignGraph(nodes, edges);

    // g1 内では p2（外へ出る端点）が右端、g2 内では p3 が左端
    expect(centerOf(aligned, "p1").x).toBeLessThan(centerOf(aligned, "p2").x);
    expect(centerOf(aligned, "p3").x).toBeLessThan(centerOf(aligned, "p4").x);
  });

  it("またぐルートの両端ポイントの縦位置が揃い、グループの位置も追従する", () => {
    const { nodes, edges } = crossGraph();
    const aligned = autoAlignGraph(nodes, edges);

    expect(centerOf(aligned, "p2").y).toBe(centerOf(aligned, "p3").y);
  });

  it("親子関係と配列の親→子順は維持され、グループのフィット規則と整合する", () => {
    const { nodes, edges } = crossGraph();
    const aligned = autoAlignGraph(nodes, edges);

    // 所属は変わらない
    const parentOf = new Map(aligned.map((n) => [n.id, n.parentId]));
    expect(parentOf.get("p1")).toBe("g1");
    expect(parentOf.get("p2")).toBe("g1");
    expect(parentOf.get("p3")).toBe("g2");
    expect(parentOf.get("p4")).toBe("g2");

    // 親グループが子より先に並ぶ
    const indexOf = new Map(aligned.map((n, i) => [n.id, i]));
    expect(indexOf.get("g1")).toBeLessThan(indexOf.get("p1") ?? -1);
    expect(indexOf.get("g2")).toBeLessThan(indexOf.get("p3") ?? -1);

    // 整列結果はフィット済み（fitGroupsToChildren を通しても変わらない）
    expect(fitGroupsToChildren(aligned)).toEqual(aligned);
  });
});

describe("autoAlignGraph: グループをまたぐルート（縦並び）", () => {
  // g1 が上・g2 が下。各グループの内部フローは横方向で、
  // またぐルート q2 → r1 は縦方向になる。
  const stackedGraph = () => ({
    nodes: [
      group("g1", 0, 0, 480, 320),
      group("g2", 0, 500, 480, 320),
      point("q1", 100, 100, "g1"),
      point("q2", 300, 100, "g1"),
      point("r1", 100, 100, "g2"),
      point("r2", 300, 100, "g2"),
    ],
    edges: [
      edge("e1", "q1", "q2"),
      edge("e2", "q2", "r1"),
      edge("e3", "r1", "r2"),
    ],
  });

  it("縦並びを尊重してグループが上下に並ぶ", () => {
    const { nodes, edges } = stackedGraph();
    const aligned = autoAlignGraph(nodes, edges);

    const g1 = groupOf(aligned, "g1");
    const g2 = groupOf(aligned, "g2");
    // 重ならず、g1 が上・g2 が下のまま
    expect(g1.position.y + (g1.height ?? 0)).toBeLessThan(g2.position.y);
  });

  it("またぐ端点は内部フローと重ならないよう、相手側に面した境界バンドへ寄る", () => {
    const { nodes, edges } = stackedGraph();
    const aligned = autoAlignGraph(nodes, edges);

    // g1 内では q2 が下側（g2 側）へ、g2 内では r1 が上側（g1 側）へ
    expect(centerOf(aligned, "q2").y).toBeGreaterThan(
      centerOf(aligned, "q1").y,
    );
    expect(centerOf(aligned, "r1").y).toBeLessThan(centerOf(aligned, "r2").y);
  });

  it("またぐルートの両端ポイントの横位置が揃う", () => {
    const { nodes, edges } = stackedGraph();
    const aligned = autoAlignGraph(nodes, edges);

    expect(centerOf(aligned, "q2").x).toBe(centerOf(aligned, "r1").x);
  });
});

describe("autoAlignGraph: プレースホルダグラフ（1F / 2F）", () => {
  const aligned = autoAlignGraph(
    PLACEHOLDER_GRAPH.nodes,
    PLACEHOLDER_GRAPH.edges,
  );

  it("2F が上・1F が下という配置を尊重し、グループが重ならない", () => {
    const floor2 = groupOf(aligned, "ph_floor2");
    const floor1 = groupOf(aligned, "ph_floor1");
    expect(floor2.position.y + (floor2.height ?? 0)).toBeLessThan(
      floor1.position.y,
    );
  });

  it("階をまたぐ端点は相手の階に面した境界バンドへ寄る", () => {
    // 1F の階段・エレベーターは 1F 内容より上（2F 側）
    expect(centerOf(aligned, "ph_stairs1f").y).toBeLessThan(
      centerOf(aligned, "ph_junction").y,
    );
    // 2F の階段・エレベーターは 2F 内容より下（1F 側)
    expect(centerOf(aligned, "ph_stairs2f").y).toBeGreaterThan(
      centerOf(aligned, "ph_hall2f").y,
    );
  });

  it("同じノードから伸びる端点は、そのノードの中心を挟んで対称に並ぶ", () => {
    // 1F 階段・エレベーターは、共通の接続元エントランスホールを挟んで左右対称
    const junction = centerOf(aligned, "ph_junction");
    const stairs1f = centerOf(aligned, "ph_stairs1f");
    const elevator1f = centerOf(aligned, "ph_elevator1f");
    expect((stairs1f.x + elevator1f.x) / 2).toBeCloseTo(junction.x);

    // 対となる 2F 側も、共通の接続先 2F ホールを挟んで対称
    const hall = centerOf(aligned, "ph_hall2f");
    const stairs2f = centerOf(aligned, "ph_stairs2f");
    const elevator2f = centerOf(aligned, "ph_elevator2f");
    expect((stairs2f.x + elevator2f.x) / 2).toBeCloseTo(hall.x);
  });

  it("階段どうし・エレベーターどうしの横位置が揃い、2 本のルートは離れている", () => {
    expect(centerOf(aligned, "ph_stairs1f").x).toBe(
      centerOf(aligned, "ph_stairs2f").x,
    );
    expect(centerOf(aligned, "ph_elevator1f").x).toBe(
      centerOf(aligned, "ph_elevator2f").x,
    );
    // 階段ルートとエレベーターのルートが同じ線上に重ならない
    expect(centerOf(aligned, "ph_stairs1f").x).not.toBe(
      centerOf(aligned, "ph_elevator1f").x,
    );
  });
});
