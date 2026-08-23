import { describe, expect, it } from "vitest";
import { toGraphData } from "./serialize";
import type { GraphCanvasNode, GraphEdgeType, GraphNodeType } from "./type";
import { isPointNode } from "./type";

/** ポイントの data を取り出す（グループには存在しないフィールドの検証用） */
function pointDataOf(node: GraphCanvasNode | undefined) {
  return node && isPointNode(node) ? node.data : undefined;
}

describe("toGraphData", () => {
  it("描画用の派生情報を除いた送信用データを作る", () => {
    const nodes: GraphNodeType[] = [
      {
        id: "n1",
        type: "graph",
        position: { x: 10.4, y: 20.6 },
        data: {
          labels: { ja: "A" },
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
      data: { labels: { ja: "A" }, nodeType: "GOAL" },
    });
    expect(pointDataOf(result.nodes[0])?.handles).toBeUndefined();

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

  it("空文字の言語ラベルは保存対象から除く", () => {
    const nodes: GraphNodeType[] = [
      {
        id: "n1",
        type: "graph",
        position: { x: 0, y: 0 },
        data: { labels: { ja: "A", en: "" }, nodeType: "GOAL" },
      },
    ];

    const result = toGraphData(nodes, []);

    expect(pointDataOf(result.nodes[0])?.labels).toEqual({ ja: "A" });
  });

  it("direction 未指定のエッジは both を補う", () => {
    const edges = [
      { id: "e1", source: "n1", target: "n2", type: "graph" },
    ] as GraphEdgeType[];
    const result = toGraphData([], edges);
    expect(result.edges[0].data?.direction).toBe("both");
  });

  it("紐づけた観測点(observationPointIds)を保持する", () => {
    const nodes: GraphNodeType[] = [
      {
        id: "n1",
        type: "graph",
        position: { x: 0, y: 0 },
        data: {
          labels: { ja: "A" },
          nodeType: "GOAL",
          observationPointIds: ["edge-1", "edge-2"],
        },
      },
    ];
    const edges: GraphEdgeType[] = [
      {
        id: "e1",
        source: "n1",
        target: "n2",
        type: "graph",
        data: { direction: "both", observationPointIds: ["edge-3"] },
      },
    ];

    const result = toGraphData(nodes, edges);

    expect(pointDataOf(result.nodes[0])?.observationPointIds).toEqual([
      "edge-1",
      "edge-2",
    ]);
    expect(result.edges[0].data?.observationPointIds).toEqual(["edge-3"]);
  });

  it("観測点が空のときは observationPointIds を出力しない", () => {
    const nodes: GraphNodeType[] = [
      {
        id: "n1",
        type: "graph",
        position: { x: 0, y: 0 },
        data: {
          labels: { ja: "A" },
          nodeType: "GOAL",
          observationPointIds: [],
        },
      },
    ];
    const result = toGraphData(nodes, []);
    expect(pointDataOf(result.nodes[0])?.observationPointIds).toBeUndefined();
  });

  it("グループは parentId・サイズ・多言語ラベル（空文字は除く）を送信用データに含める", () => {
    const nodes: GraphCanvasNode[] = [
      {
        id: "g1",
        type: "graphGroup",
        position: { x: 10.4, y: 20.6 },
        width: 480.4,
        height: 320.6,
        data: { labels: { ja: "1F", en: "" } },
      },
      {
        id: "n1",
        type: "graph",
        parentId: "g1",
        position: { x: 40, y: 60 },
        data: { labels: { ja: "A" }, nodeType: "GOAL" },
      },
    ];

    const result = toGraphData(nodes, []);

    expect(result.nodes[0]).toEqual({
      id: "g1",
      type: "graphGroup",
      position: { x: 10, y: 21 },
      width: 480,
      height: 321,
      data: { labels: { ja: "1F" } },
    });
    expect(result.nodes[1]).toMatchObject({
      id: "n1",
      type: "graph",
      parentId: "g1",
      position: { x: 40, y: 60 },
    });
  });
});
