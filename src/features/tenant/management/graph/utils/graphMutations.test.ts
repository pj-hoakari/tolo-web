import type { NodeChange } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import type {
  GraphEdgeType,
  GraphNodeType,
  GroupNodeType,
  NodeType,
} from "../type";
import {
  createEdge,
  createNode,
  EXTERNAL_NODE_ID,
  ensureExternalNode,
  isLastExternal,
  keepGroupContents,
  keepLastExternal,
  patchEdgeData,
  patchNodeData,
  patchNodeLabel,
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
    data: { labels: { ja: id }, nodeType },
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
  it("ノードは graph タイプで指定の位置・言語別ラベルを持つ", () => {
    const created = createNode({
      id: "n1",
      labels: { ja: "ポイント 1" },
      nodeType: "TRANSIT_ONLY",
      position: { x: 10, y: 20 },
    });

    expect(created).toEqual({
      id: "n1",
      type: "graph",
      position: { x: 10, y: 20 },
      data: { labels: { ja: "ポイント 1" }, nodeType: "TRANSIT_ONLY" },
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

    const next = patchNodeData(nodes, "n1", { nodeType: "TRANSIT_ONLY" });

    expect(next[0].data).toEqual({
      labels: { ja: "n1" },
      nodeType: "TRANSIT_ONLY",
    });
    expect(next[1]).toBe(nodes[1]);
  });

  it("元の配列を書き換えない", () => {
    const nodes = [node("n1")];

    patchNodeData(nodes, "n1", { nodeType: "TRANSIT_ONLY" });

    expect(nodes[0].data.nodeType).toBe("GOAL");
  });
});

describe("patchNodeLabel", () => {
  it("ポイントは指定言語のラベルだけを更新する", () => {
    const nodes = [node("n1"), node("n2")];

    const next = patchNodeLabel(nodes, "n1", "en", "Point 1");

    expect(next[0].data).toEqual({
      labels: { ja: "n1", en: "Point 1" },
      nodeType: "GOAL",
    });
    expect(next[1]).toBe(nodes[1]);
  });

  it("空文字はその言語のラベル削除として扱う", () => {
    const next = patchNodeLabel([node("n1")], "n1", "ja", "");

    expect(next[0].data).toEqual({ labels: {}, nodeType: "GOAL" });
  });

  it("グループも指定言語のラベルだけを更新する", () => {
    const group: GroupNodeType = {
      id: "g1",
      type: "graphGroup",
      position: { x: 0, y: 0 },
      data: { labels: { ja: "1F" } },
    };

    const next = patchNodeLabel([group], "g1", "en", "Floor 1");

    expect(next[0].data).toEqual({ labels: { ja: "1F", en: "Floor 1" } });
  });

  it("グループでも空文字はその言語のラベル削除として扱う", () => {
    const group: GroupNodeType = {
      id: "g1",
      type: "graphGroup",
      position: { x: 0, y: 0 },
      data: { labels: { ja: "1F", en: "Floor 1" } },
    };

    const next = patchNodeLabel([group], "g1", "en", "");

    expect(next[0].data).toEqual({ labels: { ja: "1F" } });
  });

  it("元の配列を書き換えない", () => {
    const nodes = [node("n1")];

    patchNodeLabel(nodes, "n1", "ja", "変更後");

    expect(nodes[0].data.labels).toEqual({ ja: "n1" });
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

describe("ensureExternalNode", () => {
  it("外部ポイントが無ければ、ルート要素の左上より外側に 1 つ追加する", () => {
    const nodes = [
      { ...node("n1"), position: { x: 100, y: 50 } },
      { ...node("n2"), position: { x: -40, y: 300 } },
    ];

    const next = ensureExternalNode(nodes);

    expect(next).toHaveLength(3);
    expect(next[2]).toMatchObject({
      id: EXTERNAL_NODE_ID,
      type: "graph",
      position: { x: -280, y: 0 },
      data: { labels: {}, nodeType: "EXTERNAL" },
    });
  });

  it("外部ポイントがあれば何も変えない", () => {
    const external: GraphNodeType = {
      ...node("x"),
      data: { labels: {}, nodeType: "EXTERNAL" },
    };

    const next = ensureExternalNode([node("n1"), external]);

    expect(next).toHaveLength(2);
    expect(next[1]).toBe(external);
    expect(next[1]).not.toHaveProperty("deletable");
  });

  it("新しく追加した外部ポイントは削除可否を保存しない", () => {
    expect(ensureExternalNode([node("n1")])[1]).not.toHaveProperty("deletable");
  });
});

describe("keepGroupContents", () => {
  const g1: GroupNodeType = {
    id: "g1",
    type: "graphGroup",
    position: { x: 0, y: 0 },
    data: { labels: { ja: "g1" } },
    selected: true,
  };
  const g2: GroupNodeType = {
    id: "g2",
    type: "graphGroup",
    position: { x: 0, y: 0 },
    data: { labels: { ja: "g2" } },
    parentId: "g1",
  };
  const a = { ...node("a"), parentId: "g1" };
  const b = { ...node("b"), parentId: "g2" };

  it("選択したグループだけを消し、巻き込まれた中身とそのルートは残す", () => {
    const result = keepGroupContents({
      nodes: [g1, g2, a, b],
      edges: [edge("e1", "a", "b"), edge("e2", "a", "x")],
    });

    expect(result.nodes.map((n) => n.id)).toEqual(["g1"]);
    expect(result.edges).toEqual([]);
  });

  it("中身も選択されていれば、そのポイントとルートは消す", () => {
    const selectedA = { ...a, selected: true };
    const selectedEdge = { ...edge("e3", "b", "x"), selected: true };

    const result = keepGroupContents({
      nodes: [g1, g2, selectedA, b],
      edges: [edge("e1", "a", "b"), edge("e2", "a", "x"), selectedEdge],
    });

    expect(result.nodes.map((n) => n.id)).toEqual(["g1", "a"]);
    expect(result.edges.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
  });
});

describe("keepLastExternal", () => {
  const x1 = node("x1", "EXTERNAL");
  const x2 = node("x2", "EXTERNAL");
  const n1 = node("n1");
  const all = [n1, x1, x2];

  it("すべての外部ポイントを消す削除では、先頭の外部ポイントとそのルートを残す", () => {
    const result = keepLastExternal(
      {
        nodes: [x1, x2, n1],
        edges: [edge("e1", "x1", "n1"), edge("e2", "n1", "x2")],
      },
      all,
    );

    expect(result.nodes.map((n) => n.id)).toEqual(["x2", "n1"]);
    expect(result.edges.map((e) => e.id)).toEqual(["e2"]);
  });

  it("外部ポイントが残る削除はそのまま通す", () => {
    const toDelete = { nodes: [x1], edges: [edge("e1", "x1", "n1")] };

    expect(keepLastExternal(toDelete, all)).toEqual(toDelete);
  });

  it("外部ポイントを含まない削除はそのまま通す", () => {
    const toDelete = { nodes: [n1], edges: [edge("e1", "x1", "n1")] };

    expect(keepLastExternal(toDelete, all)).toEqual(toDelete);
  });
});

describe("isLastExternal", () => {
  const x1 = node("x1", "EXTERNAL");
  const x2 = node("x2", "EXTERNAL");

  it("外部ポイントが 1 つだけならそれが最後の外部ポイント", () => {
    expect(isLastExternal("x1", [node("n1"), x1])).toBe(true);
  });

  it("外部ポイントが複数あればどれも最後ではない", () => {
    expect(isLastExternal("x1", [x1, x2])).toBe(false);
  });

  it("外部ポイント以外は最後の外部ポイントではない", () => {
    expect(isLastExternal("n1", [node("n1"), x1])).toBe(false);
  });
});
