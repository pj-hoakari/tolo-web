import { describe, expect, it } from "vitest";
import type { GraphEdgeType, GraphNodeType, HandleSide } from "../type";
import {
  assignHandlesByPosition,
  deriveNodeHandles,
  makeHandleId,
  parseHandleId,
} from "./handles";

const SIDES: HandleSide[] = ["top", "right", "bottom", "left"];

function node(id: string, x: number, y: number): GraphNodeType {
  return {
    id,
    type: "graph",
    position: { x, y },
    data: { label: id, nodeType: "GOAL" },
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  handles?: { sourceHandle: string; targetHandle: string },
): GraphEdgeType {
  return {
    id,
    source,
    target,
    type: "graph",
    data: { direction: "both" },
    ...handles,
  };
}

function slotsOf(nodes: GraphNodeType[], nodeId: string, side: HandleSide) {
  return nodes.find((n) => n.id === nodeId)?.data.handles?.[side] ?? [];
}

describe("deriveNodeHandles（接続状況からのハンドル導出）", () => {
  it("接続が無い辺は常に空きハンドルが1つ", () => {
    const derived = deriveNodeHandles([node("n1", 0, 0)], []);
    for (const side of SIDES) {
      const slots = slotsOf(derived, "n1", side);
      expect(slots).toHaveLength(1);
      expect(slots[0].used).toBe(false);
    }
  });

  it("接続のある辺のハンドルは使用済み＋空き1", () => {
    const nodes = [node("n1", 0, 0), node("n2", 300, 0)];
    const edges = [
      edge("e1", "n1", "n2", {
        sourceHandle: makeHandleId("right", 0),
        targetHandle: makeHandleId("left", 0),
      }),
    ];

    const derived = deriveNodeHandles(nodes, edges);

    const right = slotsOf(derived, "n1", "right");
    expect(right).toHaveLength(2); // 使用済み + 空き
    expect(right[0].used).toBe(true);
    expect(right[1].used).toBe(false);

    // 接続の無い辺は空き1
    expect(slotsOf(derived, "n1", "top")).toHaveLength(1);
  });

  it("同一辺への接続が増えるとハンドルが増え、空きが常に1つ", () => {
    const nodes = [node("n1", 0, 0), node("n2", 300, 0), node("n3", 300, 100)];
    const edges = [
      edge("e1", "n1", "n2", {
        sourceHandle: makeHandleId("right", 0),
        targetHandle: makeHandleId("left", 0),
      }),
      edge("e2", "n1", "n3", {
        sourceHandle: makeHandleId("right", 1),
        targetHandle: makeHandleId("left", 0),
      }),
    ];

    const right = slotsOf(deriveNodeHandles(nodes, edges), "n1", "right");

    expect(right).toHaveLength(3); // 使用済み2 + 空き
    expect(right.filter((s) => s.used)).toHaveLength(2);
    expect(right.filter((s) => !s.used)).toHaveLength(1);

    // 末尾が常に空き
    expect(right[right.length - 1].used).toBe(false);
  });

  it("接続を減らすとハンドルが減る", () => {
    const nodes = [node("n1", 0, 0), node("n2", 300, 0), node("n3", 300, 100)];
    const twoEdges = [
      edge("e1", "n1", "n2", {
        sourceHandle: makeHandleId("right", 0),
        targetHandle: makeHandleId("left", 0),
      }),
      edge("e2", "n1", "n3", {
        sourceHandle: makeHandleId("right", 1),
        targetHandle: makeHandleId("left", 0),
      }),
    ];
    expect(
      slotsOf(deriveNodeHandles(nodes, twoEdges), "n1", "right"),
    ).toHaveLength(3);

    // e2削除
    const right = slotsOf(
      deriveNodeHandles(nodes, [twoEdges[0]]),
      "n1",
      "right",
    );

    expect(right).toHaveLength(2); // 3 → 2（使用済み1 + 空き）
    expect(right.filter((s) => !s.used)).toHaveLength(1); // 空き
  });
});

describe("assignHandlesByPosition（ノード位置よる接続辺決定）", () => {
  it("水平に並ぶノードは左右の辺どうしで接続", () => {
    const nodes = [node("n1", 0, 0), node("n2", 300, 0)];
    const [e] = assignHandlesByPosition(nodes, [edge("e1", "n1", "n2")]);
    expect(parseHandleId(e.sourceHandle)?.side).toBe("right");
    expect(parseHandleId(e.targetHandle)?.side).toBe("left");
  });

  it("垂直に並ぶノードは上下の辺どうしで接続", () => {
    const nodes = [node("n1", 0, 0), node("n2", 0, 300)];
    const [e] = assignHandlesByPosition(nodes, [edge("e1", "n1", "n2")]);
    expect(parseHandleId(e.sourceHandle)?.side).toBe("bottom");
    expect(parseHandleId(e.targetHandle)?.side).toBe("top");
  });

  it("ポイントを移動すると接続辺が変わる", () => {
    const edges = [edge("e1", "n1", "n2")];

    // n2 が右
    // 左右で接続
    const horizontal = assignHandlesByPosition(
      [node("n1", 0, 0), node("n2", 300, 0)],
      edges,
    );
    expect(parseHandleId(horizontal[0].sourceHandle)?.side).toBe("right");
    expect(parseHandleId(horizontal[0].targetHandle)?.side).toBe("left");

    // n2 を下へ移動
    // 上下での接続
    const vertical = assignHandlesByPosition(
      [node("n1", 0, 0), node("n2", 0, 300)],
      edges,
    );
    expect(parseHandleId(vertical[0].sourceHandle)?.side).toBe("bottom");
    expect(parseHandleId(vertical[0].targetHandle)?.side).toBe("top");
  });

  it("同一ポイント間の複数ルートは同じ辺の別スロットに割り当て", () => {
    const nodes = [node("n1", 0, 0), node("n2", 300, 0)];
    const assigned = assignHandlesByPosition(nodes, [
      edge("e1", "n1", "n2"),
      edge("e2", "n1", "n2"),
    ]);

    const e1 = assigned.find((e) => e.id === "e1");
    const e2 = assigned.find((e) => e.id === "e2");

    // 同じ辺（right / left）でも index が分かれる
    expect(parseHandleId(e1?.sourceHandle)?.side).toBe("right");
    expect(parseHandleId(e2?.sourceHandle)?.side).toBe("right");
    expect(parseHandleId(e1?.sourceHandle)?.index).not.toBe(
      parseHandleId(e2?.sourceHandle)?.index,
    );
    expect(parseHandleId(e1?.targetHandle)?.index).not.toBe(
      parseHandleId(e2?.targetHandle)?.index,
    );
  });
});

describe("複数ルートとハンドルの統合", () => {
  it("同一ポイント間に2ルートあると両端ノードに使用済み2＋空きのハンドルができる", () => {
    const nodes = [node("n1", 0, 0), node("n2", 300, 0)];
    const assigned = assignHandlesByPosition(nodes, [
      edge("e1", "n1", "n2"),
      edge("e2", "n1", "n2"),
    ]);
    const derived = deriveNodeHandles(nodes, assigned);

    const n1Right = slotsOf(derived, "n1", "right");
    const n2Left = slotsOf(derived, "n2", "left");

    expect(n1Right.filter((s) => s.used)).toHaveLength(2);
    expect(n1Right.filter((s) => !s.used)).toHaveLength(1);
    expect(n2Left.filter((s) => s.used)).toHaveLength(2);
    expect(n2Left.filter((s) => !s.used)).toHaveLength(1);
  });
});
