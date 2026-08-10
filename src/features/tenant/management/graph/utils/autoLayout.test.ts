import { describe, expect, it } from "vitest";
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

describe("autoAlignGraph: 接続に沿った整列", () => {
  it("一直線のルートは接続順に左から右へ並び、縦位置が揃う", () => {
    // 現在位置は接続順とばらばらに置く
    const nodes = [
      point("a", 200, 300),
      point("b", 0, 0),
      point("c", 100, 150),
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

  it("分岐先は同じ列に縦へ積まれ、分岐元はその中間に揃う", () => {
    const nodes = [
      point("a", 0, 0),
      point("b", 300, 100),
      point("c", 250, 400),
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

  it("ルートで繋がっていないノードは別の塊として下に積まれる", () => {
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

describe("autoAlignGraph: グループをまたぐルート", () => {
  // g1 (p1 → p2) と g2 (p3 → p4) を p2 → p3 のルートでつなぐ。
  // 整列前は g2 が g1 の下、グループ内の並びも接続順と逆に置く。
  const crossGraph = () => ({
    nodes: [
      group("g1", 0, 0, 480, 320),
      group("g2", 0, 400, 480, 320),
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

  it("接続順に沿ってグループが左右に並ぶ", () => {
    const { nodes, edges } = crossGraph();
    const aligned = autoAlignGraph(nodes, edges);

    const byId = new Map(aligned.map((n) => [n.id, n]));
    const g1 = byId.get("g1");
    const g2 = byId.get("g2");
    if (!g1 || !isGroupNode(g1) || !g2 || !isGroupNode(g2)) {
      throw new Error("group not found");
    }
    // 重ならず、g1 が左・g2 が右
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
