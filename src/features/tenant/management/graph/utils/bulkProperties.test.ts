import { afterEach, describe, expect, it, vi } from "vitest";
import * as nodeTypes from "../nodeTypes";
import type { GraphData, GraphNodeType, NodeType } from "../type";
import { isPointNode } from "../type";
import {
  applyBulkProperty,
  bulkPropertyAvailability,
  commonValue,
} from "./bulkProperties";
import { createGroup } from "./graphMutations";

const point = (
  id: string,
  nodeType: NodeType,
  selected = true,
): GraphNodeType => ({
  id,
  type: "graph",
  position: { x: 100, y: 200 },
  selected,
  data: { nodeType, labels: { ja: id, en: id }, observationPointIds: [id] },
});
const edge = (id: string, direction: "both" | "oneway", selected = true) => ({
  id,
  type: "graph" as const,
  source: "a",
  target: "b",
  selected,
  data: { direction, label: id, observationPointIds: [id] },
});
afterEach(() => vi.restoreAllMocks());

describe("applyBulkProperty", () => {
  it("指定フラグだけを更新し、対象外・ラベル・観測点・選択状態を保持する", () => {
    const graph: GraphData = {
      nodes: [
        point("a", "GOAL"),
        point("b", "TRANSIT_ONLY"),
        point("unselected", "TRANSIT_ONLY", false),
        point("external", "EXTERNAL"),
        {
          ...createGroup({
            id: "group",
            labels: { ja: "group" },
            position: { x: 0, y: 0 },
          }),
          selected: true,
        },
      ],
      edges: [edge("e", "both")],
    };
    const { graph: next, result } = applyBulkProperty(graph, {
      kind: "nodeFlag",
      flag: "dwell",
      enabled: true,
    });
    expect(next.nodes[0]).toBe(graph.nodes[0]);
    expect((next.nodes[1] as GraphNodeType).data.nodeType).toBe(
      "GOAL_TRANSIT_MIXED",
    );
    expect(next.nodes[1]).toEqual({
      ...graph.nodes[1],
      data: { ...graph.nodes[1].data, nodeType: "GOAL_TRANSIT_MIXED" },
    });
    expect(next.nodes.slice(2)).toEqual(graph.nodes.slice(2));
    expect(next.edges).toBe(graph.edges);
    expect(result).toMatchObject({
      targetCount: 2,
      changedCount: 1,
      skippedCount: 0,
    });
    expect(graph.nodes[1]).toEqual(point("b", "TRANSIT_ONLY"));
  });
  it("目的地にできる対象のみ変更し、既に指定値の対象を失敗に数えない", () => {
    const graph: GraphData = {
      nodes: [
        point("a", "GOAL_TRANSIT_MIXED"),
        point("b", "TRANSIT_ONLY"),
        point("c", "GOAL"),
      ],
      edges: [],
    };
    const { graph: next, result } = applyBulkProperty(graph, {
      kind: "nodeFlag",
      flag: "destination",
      enabled: true,
    });
    expect(next.nodes.filter(isPointNode).map((n) => n.data.nodeType)).toEqual([
      "GOAL",
      "TRANSIT_ONLY",
      "GOAL",
    ]);
    expect(result).toEqual({
      targetCount: 3,
      changedCount: 1,
      skippedCount: 1,
      reasons: [{ kind: "operation", messageKey: "requiresDwell", count: 1 }],
    });
    const cleared = applyBulkProperty(next, {
      kind: "nodeFlag",
      flag: "destination",
      enabled: false,
    });
    expect(
      cleared.graph.nodes.filter(isPointNode).map((n) => n.data.nodeType),
    ).toEqual(["GOAL_TRANSIT_MIXED", "TRANSIT_ONLY", "GOAL_TRANSIT_MIXED"]);
    expect(cleared.result).toMatchObject({ changedCount: 2, skippedCount: 0 });
  });
  it("停滞の無効化では既存ルールどおり目的地も無効にする", () => {
    const { graph } = applyBulkProperty(
      {
        nodes: [point("a", "GOAL"), point("b", "GOAL_TRANSIT_MIXED")],
        edges: [],
      },
      { kind: "nodeFlag", flag: "dwell", enabled: false },
    );
    expect(
      graph.nodes
        .filter(isPointNode)
        .every((n) => n.data.nodeType === "TRANSIT_ONLY"),
    ).toBe(true);
  });
  it("片方向だけ反転し、両通行を理由付きで除外する", () => {
    const graph: GraphData = {
      nodes: [point("a", "GOAL"), point("b", "GOAL")],
      edges: [
        edge("e1", "oneway"),
        edge("e2", "both"),
        edge("e3", "oneway", false),
      ],
    };
    const { graph: next, result } = applyBulkProperty(graph, {
      kind: "reverseEdges",
    });
    expect(next.edges[0]).toEqual({
      ...graph.edges[0],
      source: "b",
      target: "a",
    });
    expect(next.edges.slice(1)).toEqual(graph.edges.slice(1));
    expect(next.nodes).toBe(graph.nodes);
    expect(result).toMatchObject({
      changedCount: 1,
      skippedCount: 1,
      reasons: [{ kind: "operation", messageKey: "bothNotReversed", count: 1 }],
    });
  });
  it("方向変更を配列順に検証し、反映済みのグラフを次の検証に渡す", () => {
    const graph: GraphData = {
      nodes: [point("a", "GOAL"), point("b", "GOAL")],
      edges: [edge("e1", "both"), edge("e2", "both"), edge("e3", "both")],
    };
    const validator = vi
      .spyOn(nodeTypes, "validateEdgeDirection")
      .mockImplementation((current, _, __, edges) => {
        if (current.id !== "e1")
          expect(edges[0].data?.direction).toBe("oneway");
        return current.id === "e2"
          ? { ok: false, messageKey: "boundary" }
          : { ok: true };
      });
    const { graph: next, result } = applyBulkProperty(graph, {
      kind: "edgeDirection",
      direction: "oneway",
    });
    expect(validator).toHaveBeenCalledTimes(3);
    expect(next.edges.map((e) => e.data?.direction)).toEqual([
      "oneway",
      "both",
      "oneway",
    ]);
    expect(result).toMatchObject({
      changedCount: 2,
      skippedCount: 1,
      reasons: [{ kind: "notice", messageKey: "boundary", count: 1 }],
    });
  });
  it("タイプ変更と反転の検証失敗を理由別に集計し、元のグラフを保つ", () => {
    const graph: GraphData = {
      nodes: [
        point("a", "GOAL_TRANSIT_MIXED"),
        point("b", "GOAL_TRANSIT_MIXED"),
      ],
      edges: [edge("e", "oneway")],
    };
    vi.spyOn(nodeTypes, "validateAssignType").mockReturnValue({
      ok: false,
      messageKey: "boundary",
    });
    vi.spyOn(nodeTypes, "validateReverseEdge").mockReturnValue({
      ok: false,
      messageKey: "closed",
    });
    const nodeResult = applyBulkProperty(graph, {
      kind: "nodeFlag",
      flag: "destination",
      enabled: true,
    });
    expect(nodeResult.graph).toBe(graph);
    expect(nodeResult.result.reasons).toEqual([
      { kind: "notice", messageKey: "boundary", count: 2 },
    ]);
    expect(applyBulkProperty(graph, { kind: "reverseEdges" }).graph).toBe(
      graph,
    );
  });
  it("全対象が操作不可の場合は無効になる", () => {
    const graph: GraphData = {
      nodes: [point("a", "TRANSIT_ONLY")],
      edges: [edge("e", "both")],
    };
    expect(
      bulkPropertyAvailability(graph, {
        kind: "nodeFlag",
        flag: "destination",
        enabled: true,
      }).available,
    ).toBe(false);
    expect(
      bulkPropertyAvailability(graph, { kind: "reverseEdges" }).available,
    ).toBe(false);
  });
  it("共通値と混在を区別する", () => {
    expect(commonValue([true, true])).toBe(true);
    expect(commonValue([false, false])).toBe(false);
    expect(commonValue([true, false])).toBeNull();
    expect(commonValue(["both", "oneway"])).toBeNull();
    expect(commonValue([])).toBeNull();
  });
});
