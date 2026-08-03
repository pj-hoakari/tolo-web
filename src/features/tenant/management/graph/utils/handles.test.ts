import { describe, expect, it } from "vitest";
import type { GraphEdgeType, GraphNodeType, HandleSide } from "../type";
import {
  addVirtualHandle,
  assignHandlesByPosition,
  connectHandleId,
  deriveNodeHandles,
  makeHandleId,
  parseConnectHandleId,
  parseHandleId,
  SIDES,
} from "./handles";

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
  it("接続が無い辺にはエッジ端点用ハンドルを作らない", () => {
    const derived = deriveNodeHandles([node("n1", 0, 0)], []);
    for (const side of SIDES) {
      expect(slotsOf(derived, "n1", side)).toEqual([]);
    }
  });

  it("接続のある辺にだけエッジ端点用ハンドルを作る", () => {
    const nodes = [node("n1", 0, 0), node("n2", 300, 0)];
    const edges = [
      edge("e1", "n1", "n2", {
        sourceHandle: makeHandleId("right", 0),
        targetHandle: makeHandleId("left", 0),
      }),
    ];

    const derived = deriveNodeHandles(nodes, edges);

    const right = slotsOf(derived, "n1", "right");
    expect(right).toHaveLength(1);
    expect(right[0].id).toBe(makeHandleId("right", 0));

    expect(slotsOf(derived, "n1", "top")).toEqual([]);
  });

  it("同一辺への接続数に合わせて端点用ハンドルを増やす", () => {
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

    expect(right).toHaveLength(2);
    expect(right.map((slot) => slot.id)).toEqual(["right-0", "right-1"]);
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
    ).toHaveLength(2);

    // e2削除
    const right = slotsOf(
      deriveNodeHandles(nodes, [twoEdges[0]]),
      "n1",
      "right",
    );

    expect(right).toHaveLength(1);
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
  it("同一ポイント間に2ルートあると両端ノードに端点用ハンドルが2つできる", () => {
    const nodes = [node("n1", 0, 0), node("n2", 300, 0)];
    const assigned = assignHandlesByPosition(nodes, [
      edge("e1", "n1", "n2"),
      edge("e2", "n1", "n2"),
    ]);
    const derived = deriveNodeHandles(nodes, assigned);

    const n1Right = slotsOf(derived, "n1", "right");
    const n2Left = slotsOf(derived, "n2", "left");

    expect(n1Right).toHaveLength(2);
    expect(n2Left).toHaveLength(2);
  });
});

describe("addVirtualHandle（接続ドラッグ中の仮想端点）", () => {
  it("開始ノードの開始辺だけに仮想端点を追加し、既存端点を再配置する", () => {
    const nodes = [node("n1", 0, 0), node("n2", 300, 0)];
    const assigned = assignHandlesByPosition(nodes, [
      edge("e1", "n1", "n2"),
      edge("e2", "n1", "n2"),
    ]);
    const derived = deriveNodeHandles(nodes, assigned);

    const withVirtual = addVirtualHandle(derived, "n1", "right");
    const n1Right = slotsOf(withVirtual, "n1", "right");
    const n2Left = slotsOf(withVirtual, "n2", "left");

    expect(n1Right).toHaveLength(3);
    expect(n1Right.map((slot) => slot.total)).toEqual([3, 3, 3]);
    expect(n1Right[2]).toMatchObject({
      id: "virtual-right",
      index: 2,
      virtual: true,
    });
    expect(n2Left.map((slot) => slot.total)).toEqual([2, 2]);
  });
});

describe("connectHandleId / parseConnectHandleId（辺全体の接続ハンドル ID）", () => {
  it("生成した ID から辺を取り出せる", () => {
    for (const side of SIDES) {
      expect(parseConnectHandleId(connectHandleId(side))).toBe(side);
    }
  });

  it("接続ハンドル以外の ID は null を返す", () => {
    expect(parseConnectHandleId(makeHandleId("top", 0))).toBeNull();
    expect(parseConnectHandleId("easy-connect")).toBeNull();
    expect(parseConnectHandleId("connect-diagonal")).toBeNull();
    expect(parseConnectHandleId(null)).toBeNull();
    expect(parseConnectHandleId(undefined)).toBeNull();
  });
});
