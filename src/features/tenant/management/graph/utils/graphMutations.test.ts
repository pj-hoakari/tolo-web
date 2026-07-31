import type { NodeChange } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import type { GraphEdgeType, GraphNodeType, NodeType } from "../type";
import {
  createEdge,
  createNode,
  patchEdgeData,
  patchNodeData,
  removedIds,
  reverseEdgeById,
  withoutEdge,
  withoutEdgesOf,
  withoutNode,
} from "./graphMutations";

function node(id: string, nodeType: NodeType = "GOAL"): GraphNodeType {
  return {
    id,
    type: "graph",
    position: { x: 0, y: 0 },
    data: { label: id, nodeType },
  };
}

function edge(id: string, source: string, target: string): GraphEdgeType {
  return { id, source, target, type: "graph", data: { direction: "both" } };
}

describe("removedIds", () => {
  it("削除の変更だけを ID として取り出す", () => {
    const changes: NodeChange<GraphNodeType>[] = [
      { id: "n1", type: "remove" },
      { id: "n2", type: "select", selected: true },
      { id: "n3", type: "remove" },
    ];

    expect(removedIds(changes)).toEqual(["n1", "n3"]);
  });

  it("削除が無ければ空", () => {
    expect(removedIds([{ id: "n1", type: "select", selected: false }])).toEqual(
      [],
    );
  });
});

describe("createNode / createEdge", () => {
  it("ノードは graph タイプで指定の位置・ラベルを持つ", () => {
    const created = createNode({
      id: "n1",
      label: "ポイント 1",
      nodeType: "BOUNDARY",
      position: { x: 10, y: 20 },
    });

    expect(created).toEqual({
      id: "n1",
      type: "graph",
      position: { x: 10, y: 20 },
      data: { label: "ポイント 1", nodeType: "BOUNDARY" },
    });
  });

  it("ルートは接続辺を持たない（描画時に決まる）", () => {
    const created = createEdge({
      id: "e1",
      source: "n1",
      target: "n2",
      direction: "oneway",
    });

    expect(created.data).toEqual({ direction: "oneway" });
    expect(created.sourceHandle).toBeUndefined();
    expect(created.targetHandle).toBeUndefined();
  });
});

describe("patchNodeData", () => {
  it("対象ノードの data だけを部分更新する", () => {
    const nodes = [node("n1"), node("n2")];

    const next = patchNodeData(nodes, "n1", { label: "変更後" });

    expect(next[0].data).toEqual({ label: "変更後", nodeType: "GOAL" });
    expect(next[1]).toBe(nodes[1]);
  });

  it("元の配列を書き換えない", () => {
    const nodes = [node("n1")];

    patchNodeData(nodes, "n1", { label: "変更後" });

    expect(nodes[0].data.label).toBe("n1");
  });
});

describe("patchEdgeData", () => {
  it("対象ルートの data だけを部分更新する", () => {
    const edges = [edge("e1", "n1", "n2"), edge("e2", "n2", "n3")];

    const next = patchEdgeData(edges, "e1", { direction: "oneway" });

    expect(next[0].data).toEqual({ direction: "oneway" });
    expect(next[1]).toBe(edges[1]);
  });

  it("data を持たないルートには既定の方向を補う", () => {
    const edges = [
      { id: "e1", source: "n1", target: "n2", type: "graph" } as GraphEdgeType,
    ];

    const next = patchEdgeData(edges, "e1", {
      observationPointIds: ["cam-a"],
    });

    expect(next[0].data).toEqual({
      direction: "both",
      observationPointIds: ["cam-a"],
    });
  });
});

describe("reverseEdgeById", () => {
  it("対象ルートの始点と終点を入れ替える", () => {
    const edges = [edge("e1", "n1", "n2")];

    const next = reverseEdgeById(edges, "e1");

    expect(next[0].source).toBe("n2");
    expect(next[0].target).toBe("n1");
  });
});

describe("削除", () => {
  const nodes = [node("n1"), node("n2"), node("n3")];
  const edges = [edge("e1", "n1", "n2"), edge("e2", "n2", "n3")];

  it("withoutNode は指定ノードだけを除く", () => {
    expect(withoutNode(nodes, "n2").map((n) => n.id)).toEqual(["n1", "n3"]);
  });

  it("withoutEdgesOf は指定ノードに接続するルートをすべて除く", () => {
    expect(withoutEdgesOf(edges, "n2")).toEqual([]);
    expect(withoutEdgesOf(edges, "n1").map((e) => e.id)).toEqual(["e2"]);
  });

  it("withoutEdge は指定ルートだけを除く", () => {
    expect(withoutEdge(edges, "e1").map((e) => e.id)).toEqual(["e2"]);
  });
});
