import { describe, expect, it } from "vitest";
import { toGraphData } from "./serialize";
import type { GraphEdgeType, GraphNodeType } from "./type";

describe("toGraphData", () => {
  it("描画用の派生情報を除いた送信用データを作る", () => {
    const nodes: GraphNodeType[] = [
      {
        id: "n1",
        type: "graph",
        position: { x: 10.4, y: 20.6 },
        data: {
          label: "A",
          nodeType: "GOAL",
          // 描画用の派生情報（送信対象外）
          handles: { top: [], right: [], bottom: [], left: [] },
        },
      },
    ];
    const edges: GraphEdgeType[] = [
      {
        id: "e1",
        source: "n1",
        target: "n2",
        // 位置から自動採番される描画用情報（送信対象外）
        sourceHandle: "right-0",
        targetHandle: "left-0",
        type: "graph",
        data: { direction: "oneway" },
      },
    ];

    const result = toGraphData(nodes, edges);

    // 座標は丸め、handles は除外
    expect(result.nodes[0]).toEqual({
      id: "n1",
      type: "graph",
      position: { x: 10, y: 21 },
      data: { label: "A", nodeType: "GOAL" },
    });
    expect(result.nodes[0].data.handles).toBeUndefined();

    // sourceHandle / targetHandle は除外
    expect(result.edges[0]).toEqual({
      id: "e1",
      source: "n1",
      target: "n2",
      type: "graph",
      data: { direction: "oneway" },
    });
    expect(result.edges[0].sourceHandle).toBeUndefined();
  });

  it("direction 未指定のエッジは both を補う", () => {
    const edges = [
      { id: "e1", source: "n1", target: "n2", type: "graph" },
    ] as GraphEdgeType[];
    const result = toGraphData([], edges);
    expect(result.edges[0].data?.direction).toBe("both");
  });
});
