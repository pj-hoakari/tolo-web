import { describe, expect, it } from "vitest";
import { PLACEHOLDER_GRAPH } from "@/features/graph";
import type {
  GraphCanvasNode,
  GraphEdgeType,
  GraphNodeType,
  GroupNodeType,
} from "../type";
import { isGroupNode } from "../type";
import { autoAlignGraph } from "./autoLayout";
import {
  COMPONENT_GAP,
  CROSS_GAP,
  LAYER_GAP,
  MEMBER_GAP,
  ROUTE_CLEARANCE,
} from "./autoLayout/constants";
import { absolutePositionOf, fitGroupsToChildren } from "./groups";

/** 寸法未計測時のポイントの想定サイズ（groups.ts の sizeOf と同値） */
const NODE_WIDTH = 160;
const NODE_HEIGHT = 56;

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
    data: { labels: { ja: id }, nodeType: "GOAL_TRANSIT_MIXED" },
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
    data: { labels: { ja: id } },
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

/** ポイントのみのグラフの、箱の左上の最小座標（想定サイズで計算） */
function topLeftBoundOf(nodes: GraphCanvasNode[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const node of nodes) {
    const center = absolutePositionOf(node, byId);
    minX = Math.min(minX, center.x - NODE_WIDTH / 2);
    minY = Math.min(minY, center.y - NODE_HEIGHT / 2);
  }
  return { minX, minY };
}

describe("autoAlignGraph: フローの軸と向き（ユーザーの配置から決まる）", () => {
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

  it("下から上へ流れる配置なら、その向きのまま整列する", () => {
    const nodes = [point("a", 0, 400), point("b", 50, 200), point("c", 0, 0)];
    const edges = [edge("e1", "a", "b"), edge("e2", "b", "c")];

    const aligned = autoAlignGraph(nodes, edges);

    const a = centerOf(aligned, "a");
    const b = centerOf(aligned, "b");
    const c = centerOf(aligned, "c");
    expect(a.y).toBeGreaterThan(b.y);
    expect(b.y).toBeGreaterThan(c.y);
    expect(a.x).toBe(b.x);
    expect(b.x).toBe(c.x);
  });
});

describe("autoAlignGraph: 層（列）の割り当て", () => {
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

  it("合流元は同じ列に並び、合流先はその中間の先に揃う", () => {
    const nodes = [point("a", 0, 0), point("b", 0, 300), point("c", 400, 150)];
    const edges = [edge("e1", "a", "c"), edge("e2", "b", "c")];

    const aligned = autoAlignGraph(nodes, edges);

    const a = centerOf(aligned, "a");
    const b = centerOf(aligned, "b");
    const c = centerOf(aligned, "c");
    expect(a.x).toBe(b.x);
    expect(c.x).toBeGreaterThan(a.x);
    expect(c.y).toBeCloseTo((a.y + b.y) / 2);
  });

  it("循環があっても破綻せず、逆流を除いた流れの順に並ぶ", () => {
    const nodes = [point("a", 0, 0), point("b", 300, 0), point("c", 600, 0)];
    const edges = [
      edge("e1", "a", "b"),
      edge("e2", "b", "c"),
      edge("e3", "c", "a"),
    ];

    const aligned = autoAlignGraph(nodes, edges);

    const a = centerOf(aligned, "a");
    const b = centerOf(aligned, "b");
    const c = centerOf(aligned, "c");
    for (const p of [a, b, c]) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
    expect(a.x).toBeLessThan(b.x);
    expect(b.x).toBeLessThan(c.x);
  });
});

describe("autoAlignGraph: 最低マージン（箱の端から端まで）", () => {
  it("列の間はフロー軸方向に LAYER_GAP 空く", () => {
    const nodes = [
      point("a", 0, 300),
      point("b", 300, 150),
      point("c", 600, 0),
    ];
    const edges = [edge("e1", "a", "b"), edge("e2", "b", "c")];

    const aligned = autoAlignGraph(nodes, edges);

    const a = centerOf(aligned, "a");
    const b = centerOf(aligned, "b");
    expect(b.x - NODE_WIDTH / 2 - (a.x + NODE_WIDTH / 2)).toBe(LAYER_GAP);
  });

  it("同じ列に積まれるノードの間はクロス軸方向に CROSS_GAP 空く", () => {
    const nodes = [
      point("a", 0, 0),
      point("b", 400, 100),
      point("c", 350, 300),
    ];
    const edges = [edge("e1", "a", "b"), edge("e2", "a", "c")];

    const aligned = autoAlignGraph(nodes, edges);

    const b = centerOf(aligned, "b");
    const c = centerOf(aligned, "c");
    expect(c.y - NODE_HEIGHT / 2 - (b.y + NODE_HEIGHT / 2)).toBe(CROSS_GAP);
  });

  it("ルートで繋がっていない塊は COMPONENT_GAP 離して下に積まれる", () => {
    const nodes = [point("a", 0, 0), point("b", 300, 0), point("z", 600, 0)];
    const edges = [edge("e1", "a", "b")];

    const aligned = autoAlignGraph(nodes, edges);

    const a = centerOf(aligned, "a");
    const b = centerOf(aligned, "b");
    const z = centerOf(aligned, "z");
    expect(z.y).toBeGreaterThan(Math.max(a.y, b.y));
    expect(z.y - NODE_HEIGHT / 2 - (a.y + NODE_HEIGHT / 2)).toBe(COMPONENT_GAP);
  });
});

describe("autoAlignGraph: 層をまたぐルートの通り道（レーン）", () => {
  it("A→B→C と A→C があるとき、B と C は A の中心を挟んで上下に分かれる", () => {
    const nodes = [point("a", 0, 0), point("b", 300, 0), point("c", 600, 0)];
    const edges = [
      edge("e1", "a", "b"),
      edge("e2", "b", "c"),
      edge("e3", "a", "c"),
    ];

    const aligned = autoAlignGraph(nodes, edges);

    const a = centerOf(aligned, "a");
    const b = centerOf(aligned, "b");
    const c = centerOf(aligned, "c");
    // 主軸方向は既存どおり: A → B → C の順
    expect(a.x).toBeLessThan(b.x);
    expect(b.x).toBeLessThan(c.x);
    // 直通ルート A→C が B と重ならないよう、B と C は A を挟んで上下に分かれる
    expect(b.y).toBeLessThan(a.y);
    expect(c.y).toBeGreaterThan(a.y);
  });

  it("またがれるノードと通り道の間は、通常の間隔より広く空く", () => {
    const nodes = [point("a", 0, 0), point("b", 300, 0), point("c", 600, 0)];
    const edges = [
      edge("e1", "a", "b"),
      edge("e2", "b", "c"),
      edge("e3", "a", "c"),
    ];

    const aligned = autoAlignGraph(nodes, edges);

    // C は B の列に確保されたレーン（占有幅 ROUTE_CLEARANCE）へ揃うため、
    // B との中心距離はレーンを挟んだ間隔になる
    const b = centerOf(aligned, "b");
    const c = centerOf(aligned, "c");
    expect(c.y - b.y).toBeCloseTo(
      (NODE_HEIGHT + ROUTE_CLEARANCE) / 2 + CROSS_GAP,
    );
  });

  it("複数列を飛び越すルートでも、途中の列のノードがルートの通り道を空ける", () => {
    const nodes = [
      point("a", 0, 0),
      point("b", 300, 0),
      point("c", 600, 0),
      point("d", 900, 0),
    ];
    const edges = [
      edge("e1", "a", "b"),
      edge("e2", "b", "c"),
      edge("e3", "c", "d"),
      edge("e4", "a", "d"),
    ];

    const aligned = autoAlignGraph(nodes, edges);

    const a = centerOf(aligned, "a");
    const b = centerOf(aligned, "b");
    const c = centerOf(aligned, "c");
    const d = centerOf(aligned, "d");
    // 中間ノード B・C は直通ルートの通り道（A→D の側）から離れて同じ側に揃う
    expect(b.y).toBeLessThan(a.y);
    expect(c.y).toBeLessThan(a.y);
    expect(d.y).toBeGreaterThan(a.y);
  });

  it("直通ルートの通り道は、ユーザーが端点を置いた側に確保される", () => {
    // ユーザーが C を B より上へ置いている場合、A→C の通り道は上側になる
    const nodes = [
      point("a", 0, 200),
      point("b", 300, 300),
      point("c", 600, 0),
    ];
    const edges = [
      edge("e1", "a", "b"),
      edge("e2", "b", "c"),
      edge("e3", "a", "c"),
    ];

    const aligned = autoAlignGraph(nodes, edges);

    expect(centerOf(aligned, "c").y).toBeLessThan(centerOf(aligned, "a").y);
    expect(centerOf(aligned, "b").y).toBeGreaterThan(centerOf(aligned, "a").y);
  });
});

describe("autoAlignGraph: 同じ層のノード同士のルート（兄弟ルート）", () => {
  // α→A→β / α→B→β / α→C→β の並列構造（A・B・C は同じ層）
  const parallelGraph = (extraEdges: GraphEdgeType[]) => ({
    nodes: [
      point("alpha", 0, 150),
      point("a", 300, 0),
      point("b", 300, 150),
      point("c", 300, 300),
      point("beta", 600, 150),
    ],
    edges: [
      edge("e1", "alpha", "a"),
      edge("e2", "alpha", "b"),
      edge("e3", "alpha", "c"),
      edge("e4", "a", "beta"),
      edge("e5", "b", "beta"),
      edge("e6", "c", "beta"),
      ...extraEdges,
    ],
  });

  it("同じ相手に接続されるノード同士のルートでは層が分かれない", () => {
    // A→B と B→C（隣どうしの連絡）があっても A・B・C は同じ列のまま
    const { nodes, edges } = parallelGraph([
      edge("e7", "a", "b"),
      edge("e8", "b", "c"),
    ]);

    const aligned = autoAlignGraph(nodes, edges);

    const a = centerOf(aligned, "a");
    const b = centerOf(aligned, "b");
    const c = centerOf(aligned, "c");
    // 隣どうしを繋ぐだけなのでオフセットもなし（横位置が揃う）
    expect(a.x).toBe(b.x);
    expect(b.x).toBe(c.x);
    expect(a.y).toBeLessThan(b.y);
    expect(b.y).toBeLessThan(c.y);
    // 前後の層は左右に分かれたまま
    expect(centerOf(aligned, "alpha").x).toBeLessThan(a.x);
    expect(centerOf(aligned, "beta").x).toBeGreaterThan(a.x);
  });

  it("同じ層でノードをまたぐルートがあると、またがれる側と遠い端点が左右へ離れる", () => {
    // A→B と A→C: A→C は間の B をまたぐ
    const { nodes, edges } = parallelGraph([
      edge("e7", "a", "b"),
      edge("e8", "a", "c"),
    ]);

    const aligned = autoAlignGraph(nodes, edges);

    const a = centerOf(aligned, "a");
    const b = centerOf(aligned, "b");
    const c = centerOf(aligned, "c");
    // B（またがれる側）と C（遠い端点）が A を挟んで左右に分かれる
    expect(b.x).toBeLessThan(a.x);
    expect(c.x).toBeGreaterThan(a.x);
    // 縦の並び順はそのまま
    expect(a.y).toBeLessThan(b.y);
    expect(b.y).toBeLessThan(c.y);
  });

  it("共有する相手が片側（流入元）だけなら兄弟ルートとみなさず、層が分かれる", () => {
    // A→B・A→C・B→C: B と C は A（流入元）しか共有しないため、
    // B→C は流れとして扱われ C は B の次の列になる
    const nodes = [point("a", 0, 0), point("b", 300, 0), point("c", 600, 0)];
    const edges = [
      edge("e1", "a", "b"),
      edge("e2", "a", "c"),
      edge("e3", "b", "c"),
    ];

    const aligned = autoAlignGraph(nodes, edges);

    expect(centerOf(aligned, "b").x).toBeLessThan(centerOf(aligned, "c").x);
  });
});

describe("autoAlignGraph: ユーザーの並べ替えの尊重", () => {
  /** ブースA と 壁展示 の位置を入れ替えたノード配列 */
  const withSwappedBoothAndWall = (nodes: GraphCanvasNode[]) => {
    const booth = nodes.find((n) => n.id === "ph_booth");
    const wall = nodes.find((n) => n.id === "ph_wall");
    if (!booth || !wall) throw new Error("node not found");
    return nodes.map((n) => {
      if (n.id === "ph_booth") return { ...n, position: { ...wall.position } };
      if (n.id === "ph_wall") return { ...n, position: { ...booth.position } };
      return n;
    });
  };

  it("同じ列のポイントの上下を入れ替えてから整列すると、入れ替え後の順序が保たれる", () => {
    const nodes = withSwappedBoothAndWall(PLACEHOLDER_GRAPH.nodes);
    const aligned = autoAlignGraph(nodes, PLACEHOLDER_GRAPH.edges);
    expect(centerOf(aligned, "ph_wall").y).toBeLessThan(
      centerOf(aligned, "ph_booth").y,
    );
  });

  it("整列 → 入れ替え → 再整列でも、入れ替え後の順序が保たれる", () => {
    const once = autoAlignGraph(
      PLACEHOLDER_GRAPH.nodes,
      PLACEHOLDER_GRAPH.edges,
    );
    const aligned = autoAlignGraph(
      withSwappedBoothAndWall(once),
      PLACEHOLDER_GRAPH.edges,
    );
    expect(centerOf(aligned, "ph_wall").y).toBeLessThan(
      centerOf(aligned, "ph_booth").y,
    );
  });

  it("境界バンドのポイントの左右を入れ替えてから整列すると、入れ替え後の順序が保たれる", () => {
    // 1F の階段とエレベーターを左右入れ替え（対の 2F 側はそのまま）
    const nodes = PLACEHOLDER_GRAPH.nodes.map((n) => {
      if (n.id === "ph_stairs1f") return { ...n, position: { x: 540, y: 70 } };
      if (n.id === "ph_elevator1f") {
        return { ...n, position: { x: 260, y: 70 } };
      }
      return n;
    });
    const aligned = autoAlignGraph(nodes, PLACEHOLDER_GRAPH.edges);
    expect(centerOf(aligned, "ph_elevator1f").x).toBeLessThan(
      centerOf(aligned, "ph_stairs1f").x,
    );
  });

  it("ルートで繋がっていない塊どうしは、現在の上下の並び順のまま積まれる", () => {
    // 配列上は chain1 が先だが、ユーザーは chain2 を上に置いている
    const nodes = [
      point("a1", 0, 300),
      point("b1", 300, 300),
      point("a2", 0, 0),
      point("b2", 300, 0),
    ];
    const edges = [edge("e1", "a1", "b1"), edge("e2", "a2", "b2")];

    const aligned = autoAlignGraph(nodes, edges);

    expect(centerOf(aligned, "a2").y).toBeLessThan(centerOf(aligned, "a1").y);
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

describe("autoAlignGraph: グループの扱い", () => {
  it("ネストしたグループも再帰的に整列され、親子関係が保たれる", () => {
    const nodes = [
      group("g1", 0, 0, 800, 600),
      group("g2", 50, 50, 300, 200, "g1"),
      point("p1", 100, 100, "g2"),
      point("p2", 600, 300, "g1"),
    ];
    const edges = [edge("e1", "p1", "p2")];

    const aligned = autoAlignGraph(nodes, edges);

    const parentOf = new Map(aligned.map((n) => [n.id, n.parentId]));
    expect(parentOf.get("g2")).toBe("g1");
    expect(parentOf.get("p1")).toBe("g2");
    expect(parentOf.get("p2")).toBe("g1");
    // 内側グループ → 外のポイントへの流れ（左→右）が保たれる
    expect(centerOf(aligned, "p1").x).toBeLessThan(centerOf(aligned, "p2").x);
    // フィット規則と整合する
    expect(fitGroupsToChildren(aligned)).toEqual(aligned);
  });

  it("空のグループは既定サイズを保ったまま独立した塊として置かれる", () => {
    const nodes = [
      group("gEmpty", 0, 0, 480, 320),
      point("a", 600, 100),
      point("b", 900, 100),
    ];
    const edges = [edge("e1", "a", "b")];

    const aligned = autoAlignGraph(nodes, edges);

    const gEmpty = groupOf(aligned, "gEmpty");
    expect(gEmpty.width).toBe(480);
    expect(gEmpty.height).toBe(320);
    expect(Number.isFinite(gEmpty.position.x)).toBe(true);
    expect(Number.isFinite(gEmpty.position.y)).toBe(true);
  });

  it("手動リサイズの最小サイズ（minWidth / minHeight）は整列後も保たれる", () => {
    const resized: GroupNodeType = {
      ...group("g1", 0, 0, 700, 400),
      data: { labels: { ja: "g1" }, minWidth: 700, minHeight: 400 },
    };
    const nodes = [resized, point("p1", 100, 100, "g1")];

    const aligned = autoAlignGraph(nodes, []);

    const g1 = groupOf(aligned, "g1");
    expect(g1.width).toBe(700);
    expect(g1.height).toBe(400);
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

  it("境界バンドと内容の間には CROSS_GAP、バンド内の横間隔には MEMBER_GAP が空く", () => {
    // 2F ホール（内容の下端）と 2F 階段（バンド）の縦の隙間
    const hall = centerOf(aligned, "ph_hall2f");
    const stairs2f = centerOf(aligned, "ph_stairs2f");
    expect(stairs2f.y - NODE_HEIGHT / 2 - (hall.y + NODE_HEIGHT / 2)).toBe(
      CROSS_GAP,
    );

    // バンド内で横に並ぶ 1F 階段と 1F エレベーターの隙間
    const stairs1f = centerOf(aligned, "ph_stairs1f");
    const elevator1f = centerOf(aligned, "ph_elevator1f");
    expect(elevator1f.x - NODE_WIDTH / 2 - (stairs1f.x + NODE_WIDTH / 2)).toBe(
      MEMBER_GAP,
    );
  });
});

describe("autoAlignGraph: 全体の不変条件", () => {
  it("同じ入力からは常に同じ結果になる（決定性）", () => {
    const nodes = [
      group("g1", 0, 0, 480, 320),
      point("a", 100, 100, "g1"),
      point("b", 300, 200, "g1"),
      point("c", 700, 100),
    ];
    const edges = [edge("e1", "a", "b"), edge("e2", "b", "c")];

    expect(autoAlignGraph(nodes, edges)).toEqual(autoAlignGraph(nodes, edges));
  });

  it("整列済みのグラフをもう一度整列しても変わらない（冪等）", () => {
    const once = autoAlignGraph(
      PLACEHOLDER_GRAPH.nodes,
      PLACEHOLDER_GRAPH.edges,
    );
    expect(autoAlignGraph(once, PLACEHOLDER_GRAPH.edges)).toEqual(once);
  });

  it("変わるのは位置とグループのサイズだけで、ID・並び順・データは保たれる", () => {
    const nodes = [
      group("g1", 0, 0, 480, 320),
      point("a", 100, 100, "g1"),
      point("b", 600, 100),
    ];
    const edges = [edge("e1", "a", "b")];

    const aligned = autoAlignGraph(nodes, edges);

    expect(aligned.map((n) => n.id)).toEqual(nodes.map((n) => n.id));
    expect(aligned.map((n) => n.type)).toEqual(nodes.map((n) => n.type));
    expect(aligned.map((n) => n.parentId)).toEqual(
      nodes.map((n) => n.parentId),
    );
    // data はそのままのオブジェクトを保持する
    for (const [i, node] of aligned.entries()) {
      expect(node.data).toBe(nodes[i].data);
    }
  });

  it("全体のバウンディングボックスの左上は整列前と変わらない（画面の大移動を避ける）", () => {
    const nodes = [
      point("a", 0, 300),
      point("b", 300, 150),
      point("c", 600, 0),
    ];
    const edges = [edge("e1", "a", "b"), edge("e2", "b", "c")];

    const aligned = autoAlignGraph(nodes, edges);

    const before = topLeftBoundOf(nodes);
    const after = topLeftBoundOf(aligned);
    expect(after.minX).toBeCloseTo(before.minX);
    expect(after.minY).toBeCloseTo(before.minY);
  });

  it("ノードが無ければそのまま返す", () => {
    expect(autoAlignGraph([], [])).toEqual([]);
  });

  it("存在しないノードを参照するルートは無視される", () => {
    const nodes = [point("a", 0, 0), point("b", 300, 80)];
    const edges = [edge("e1", "a", "b"), edge("e2", "a", "ghost")];

    const aligned = autoAlignGraph(nodes, edges);

    const a = centerOf(aligned, "a");
    const b = centerOf(aligned, "b");
    expect(a.x).toBeLessThan(b.x);
    expect(a.y).toBe(b.y);
  });
});
