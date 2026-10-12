import { describe, expect, it } from "vitest";
import type {
  GraphCanvasNode,
  GraphData,
  GraphNodeType,
  GroupNodeType,
} from "../type";
import { createGroup } from "./graphMutations";
import { absolutePositionOf, fitGroupsToChildren } from "./groups";
import {
  canDeleteSelectedElements,
  deleteSelectedElements,
  getGroupSelectionError,
  groupSelectedPoints,
} from "./selectionActions";

const point = (
  id: string,
  x: number,
  y: number,
  parentId?: string,
): GraphNodeType => ({
  id,
  type: "graph",
  position: { x, y },
  parentId,
  selected: true,
  data: {
    labels: { ja: id, en: `en-${id}` },
    nodeType: "GOAL",
    observationPointIds: [id],
  },
});
const group = (id: string, parentId?: string): GroupNodeType => ({
  ...createGroup({ id, labels: { ja: id }, position: { x: 100, y: 200 } }),
  parentId,
});
const edge = (
  id: string,
  source: string,
  target: string,
  selected = false,
) => ({
  id,
  source,
  target,
  selected,
  type: "graph" as const,
  data: { direction: "both" as const },
});
const absolutePositions = (nodes: GraphCanvasNode[]) => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return Object.fromEntries(
    nodes.map((n) => [n.id, absolutePositionOf(n, byId)]),
  );
};

describe("groupSelectedPoints", () => {
  it.each([undefined, "parent"])(
    "同じ所属 %s のポイントをまとめ、位置・データ・接続を保つ",
    (parentId) => {
      const initial: GraphData = {
        nodes: fitGroupsToChildren([
          ...(parentId ? [group(parentId)] : []),
          point("a", 160, 180, parentId),
          point("b", 440, 300, parentId),
          { ...point("c", 600, 400, parentId), selected: false },
        ]),
        edges: [edge("e1", "a", "b", true), edge("e2", "b", "c")],
      };
      const before = absolutePositions(initial.nodes);
      const next = groupSelectedPoints(initial, group("new"));
      expect(next.nodes.find((n) => n.id === "new")?.parentId).toBe(parentId);
      expect(next.nodes.find((n) => n.id === "a")?.parentId).toBe("new");
      expect(next.nodes.find((n) => n.id === "b")?.parentId).toBe("new");
      expect(next.nodes.find((n) => n.id === "c")?.parentId).toBe(parentId);
      const after = absolutePositions(next.nodes);
      for (const id of ["a", "b", "c"]) expect(after[id]).toEqual(before[id]);
      expect(next.nodes.find((n) => n.id === "a")?.data).toEqual(
        initial.nodes.find((n) => n.id === "a")?.data,
      );
      expect(next.nodes.filter((n) => n.selected).map((n) => n.id)).toEqual([
        "new",
      ]);
      expect(next.edges).toEqual(
        initial.edges.map((e) => ({ ...e, selected: false })),
      );
      expect(initial.nodes.filter((n) => n.selected).map((n) => n.id)).toEqual([
        "a",
        "b",
      ]);
    },
  );
  it("ネストした共通の親の直下に作成する", () => {
    const graph: GraphData = {
      nodes: [
        group("outer"),
        group("inner", "outer"),
        point("a", 100, 100, "inner"),
        point("b", 200, 100, "inner"),
      ],
      edges: [],
    };
    const next = groupSelectedPoints(graph, group("new"));
    expect(next.nodes.find((n) => n.id === "new")?.parentId).toBe("inner");
    for (const id of ["a", "b"])
      expect(absolutePositions(next.nodes)[id]).toEqual(
        absolutePositions(graph.nodes)[id],
      );
  });
  it("計測済みグループ内で繰り返しグループ化しても祖先の枠に収まる", () => {
    let graph: GraphData = {
      nodes: fitGroupsToChildren([
        group("parent"),
        point("a", 100, 100, "parent"),
        point("b", 200, 300, "parent"),
      ]),
      edges: [],
    };
    const before = absolutePositions(graph.nodes);
    let parentId = "parent";
    for (const id of ["new1", "new2", "new3"]) {
      graph = {
        ...graph,
        nodes: graph.nodes.map((node) => ({
          ...node,
          selected: node.id === "a" || node.id === "b",
          ...(node.type === "graphGroup"
            ? { measured: { width: node.width, height: node.height } }
            : {}),
        })),
      };
      graph = groupSelectedPoints(graph, group(id));
      const positions = absolutePositions(graph.nodes);
      const byId = new Map(graph.nodes.map((node) => [node.id, node]));
      expect(byId.get(id)?.parentId).toBe(parentId);
      for (const node of graph.nodes.filter(
        (node) => node.type === "graphGroup" && node.parentId,
      )) {
        const parent = byId.get(node.parentId as string);
        if (!parent) throw new Error("Missing parent");
        expect(positions[node.id].x).toBeGreaterThanOrEqual(
          positions[parent.id].x,
        );
        expect(positions[node.id].y).toBeGreaterThanOrEqual(
          positions[parent.id].y,
        );
        expect(positions[node.id].x + (node.width ?? 0)).toBeLessThanOrEqual(
          positions[parent.id].x + (parent.width ?? 0),
        );
        expect(positions[node.id].y + (node.height ?? 0)).toBeLessThanOrEqual(
          positions[parent.id].y + (parent.height ?? 0),
        );
      }
      expect(positions.a).toEqual(before.a);
      expect(positions.b).toEqual(before.b);
      parentId = id;
    }
  });

  it.each([
    { nodes: [point("a", 0, 0)], error: "tooFewPoints" },
    {
      nodes: [point("a", 0, 0, "g"), point("b", 0, 0)],
      error: "differentParents",
    },
    {
      nodes: [point("a", 0, 0), { ...group("g"), selected: true }],
      error: "pointsOnly",
    },
    {
      nodes: [
        point("a", 0, 0),
        {
          ...point("external", 0, 0),
          data: { labels: {}, nodeType: "EXTERNAL" as const },
        },
      ],
      error: "pointsOnly",
    },
  ])("無効な選択 $error は変更しない", ({ nodes, error }) => {
    const graph: GraphData = { nodes, edges: [] };
    expect(getGroupSelectionError(nodes)).toBe(error);
    expect(groupSelectedPoints(graph, group("new"))).toBe(graph);
  });
});

describe("deleteSelectedElements", () => {
  it("混在選択を削除し、未選択の子と接続を残す", () => {
    const initial: GraphData = {
      nodes: [
        { ...group("outer"), selected: true },
        { ...group("inner", "outer"), selected: true },
        point("a", 100, 100, "inner"),
        { ...point("b", 200, 100, "inner"), selected: false },
        { ...point("c", 500, 500), selected: false },
      ],
      edges: [
        edge("attached", "a", "b"),
        edge("selected", "b", "c", true),
        edge("kept", "b", "c"),
      ],
    };
    const before = absolutePositions(initial.nodes);
    const next = deleteSelectedElements(initial);
    expect(next.nodes.map((n) => n.id)).toEqual(["b", "c"]);
    expect(next.nodes[0].parentId).toBeUndefined();
    expect(absolutePositions(next.nodes)).toEqual({ b: before.b, c: before.c });
    expect(next.edges.map((e) => e.id)).toEqual(["kept"]);
  });
  it("全外部ポイントを選んでも1件を保護し、その接続矢印も既存ルールどおり保護する", () => {
    const external = (id: string) => ({
      ...point(id, 0, 0),
      data: { labels: {}, nodeType: "EXTERNAL" as const },
    });
    const graph: GraphData = {
      nodes: [
        external("x1"),
        external("x2"),
        { ...point("a", 100, 100), selected: false },
      ],
      edges: [edge("e1", "x1", "a", true), edge("e2", "x2", "a")],
    };
    const next = deleteSelectedElements(graph);
    expect(next.nodes.map((n) => n.id)).toEqual(["x1", "a"]);
    expect(next.edges.map((e) => e.id)).toEqual(["e1"]);
    expect(next.nodes[0].selected).toBe(true);
    expect(canDeleteSelectedElements(next)).toBe(false);
    expect(deleteSelectedElements(next)).toBe(next);
  });
  it("選択した矢印だけを削除できる", () => {
    const graph: GraphData = {
      nodes: [{ ...point("a", 0, 0), selected: false }],
      edges: [edge("e1", "a", "a", true), edge("e2", "a", "a", true)],
    };
    expect(canDeleteSelectedElements(graph)).toBe(true);
    expect(deleteSelectedElements(graph).nodes).toEqual(graph.nodes);
    expect(deleteSelectedElements(graph).edges).toEqual([]);
  });
});
