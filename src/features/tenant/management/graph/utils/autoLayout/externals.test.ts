import { describe, expect, it } from "vitest";
import type { GraphEdgeType, GraphNodeType } from "../../type";
import { LAYER_GAP, MEMBER_GAP } from "./constants";
import { placeExternals } from "./externals";

const NODE_WIDTH = 160;
const NODE_HEIGHT = 56;

function point(id: string, x: number, y: number): GraphNodeType {
  return {
    id,
    type: "graph",
    position: { x, y },
    data: { labels: { ja: id }, nodeType: "GOAL_TRANSIT_MIXED" },
  };
}

function external(id: string, x = 0, y = 0): GraphNodeType {
  return {
    id,
    type: "graph",
    position: { x, y },
    data: { labels: {}, nodeType: "EXTERNAL" },
  };
}

function edge(id: string, source: string, target: string): GraphEdgeType {
  return { id, source, target, type: "graph", data: { direction: "both" } };
}

function endpoints(edges: GraphEdgeType[]) {
  return Object.fromEntries(edges.map((e) => [e.id, [e.source, e.target]]));
}

describe("placeExternals", () => {
  const chain = [point("a", 0, 0), point("b", 400, 0), point("c", 800, 0)];

  it("左端の入口と右端の出口には、それぞれの外側に外部ポイントを置いて付け替える", () => {
    const result = placeExternals({
      aligned: chain,
      externals: [external("x")],
      externalEdges: [edge("in", "x", "a"), edge("out", "c", "x")],
    });

    expect(result.externals.map((n) => [n.id, n.position])).toEqual([
      ["x", { x: -NODE_WIDTH / 2 - LAYER_GAP - NODE_WIDTH / 2, y: 0 }],
      [
        "external-c",
        { x: 800 + NODE_WIDTH / 2 + LAYER_GAP + NODE_WIDTH / 2, y: 0 },
      ],
    ]);
    expect(result.externals[1].data).toEqual({
      labels: {},
      nodeType: "EXTERNAL",
    });
    expect(endpoints(result.externalEdges)).toEqual({
      in: ["x", "a"],
      out: ["c", "external-c"],
    });
  });

  const tall = [
    point("a", 0, 200),
    point("b", 0, 300),
    point("c", 600, 0),
    point("d", 600, 600),
  ];

  it("同じ辺で近い入退出点は 1 つの外部ポイントにまとめ、余った外部ポイントは取り除く", () => {
    const result = placeExternals({
      aligned: tall,
      externals: [external("x"), external("y")],
      externalEdges: [edge("in", "x", "a"), edge("out", "b", "y")],
    });

    expect(result.externals.map((n) => [n.id, n.position])).toEqual([
      ["x", { x: -NODE_WIDTH / 2 - LAYER_GAP - NODE_WIDTH / 2, y: 250 }],
    ]);
    expect(endpoints(result.externalEdges)).toEqual({
      in: ["x", "a"],
      out: ["b", "x"],
    });
  });

  it("まとめる距離はオプションで変えられる", () => {
    const input = {
      aligned: tall,
      externals: [external("x")],
      externalEdges: [edge("in", "x", "a"), edge("out", "b", "x")],
    };

    expect(placeExternals(input, { clusterGap: 50 }).externals).toHaveLength(2);
    expect(placeExternals(input).externals).toHaveLength(1);
  });

  it("各まとまりには、そのまとまりで最も多く使われていた外部ポイントを割り当てる", () => {
    const result = placeExternals({
      aligned: chain,
      externals: [external("x"), external("y")],
      externalEdges: [edge("in", "y", "a"), edge("out", "c", "x")],
    });

    expect(result.externals.map((n) => n.id)).toEqual(["x", "y"]);
    expect(endpoints(result.externalEdges)).toEqual({
      in: ["y", "a"],
      out: ["c", "x"],
    });
  });

  it("新しい ID が既存のノードと重なるときは連番を付ける", () => {
    const result = placeExternals({
      aligned: [...chain, point("external-c", 400, 400)],
      externals: [external("x")],
      externalEdges: [edge("in", "x", "a"), edge("out", "c", "x")],
    });

    expect(result.externals.map((n) => n.id)).toEqual(["x", "external-c-2"]);
  });

  it("自分の出力に適用しても変わらない（冪等）", () => {
    const once = placeExternals({
      aligned: [...chain, point("d", 400, 600)],
      externals: [external("x"), external("y")],
      externalEdges: [
        edge("in", "x", "a"),
        edge("out", "c", "y"),
        edge("down", "d", "y"),
      ],
    });
    const twice = placeExternals({
      aligned: [...chain, point("d", 400, 600)],
      externals: once.externals,
      externalEdges: once.externalEdges,
    });

    expect(twice).toEqual(once);
  });

  it("接続のない外部ポイントはすべて残し、配置の下に横一列で並べる", () => {
    const result = placeExternals({
      aligned: chain,
      externals: [external("x", -500, -500), external("y", 900, 900)],
      externalEdges: [],
    });

    const y = NODE_HEIGHT / 2 + LAYER_GAP + NODE_HEIGHT / 2;
    const half = (NODE_WIDTH + MEMBER_GAP) / 2;
    expect(result.externals.map((n) => [n.id, n.position])).toEqual([
      ["x", { x: 400 - half, y }],
      ["y", { x: 400 + half, y }],
    ]);
  });

  it("相手が存在しない接続は付け替えない", () => {
    const ghost = edge("ghost", "x", "missing");
    const result = placeExternals({
      aligned: chain,
      externals: [external("x")],
      externalEdges: [edge("in", "x", "a"), ghost],
    });

    expect(result.externalEdges[1]).toBe(ghost);
  });
});
