// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GraphData, GraphEdgeType, GraphNodeType } from "../type";
import { collectObservationPointIds } from "../utils/observationPoints";
import { useGraphViewer } from "./useGraphViewer";

function node(id: string, x: number, y: number): GraphNodeType {
  return {
    id,
    type: "graph",
    position: { x, y },
    data: { label: id, nodeType: "GOAL" },
  };
}

function edge(id: string, source: string, target: string): GraphEdgeType {
  return { id, source, target, type: "graph", data: { direction: "both" } };
}

function initialGraph(): GraphData {
  return {
    nodes: [node("n1", 0, 0), node("n2", 300, 0)],
    edges: [edge("e1", "n1", "n2")],
  };
}

describe("useGraphViewer: 観測点の紐づけ", () => {
  it("ポイントに紐づけた観測点が保存用データに含まれる", () => {
    const { result } = renderHook(() => useGraphViewer(initialGraph()));

    act(() => {
      result.current.links.onLinkNode("n1", ["cam-a"]);
    });

    const data = result.current.getGraphData();
    expect(
      data.nodes.find((n) => n.id === "n1")?.data.observationPointIds,
    ).toEqual(["cam-a"]);
  });

  it("ルートに紐づけた観測点が保存用データに含まれる", () => {
    const { result } = renderHook(() => useGraphViewer(initialGraph()));

    act(() => {
      result.current.links.onLinkEdge("e1", ["cam-b"]);
    });

    const data = result.current.getGraphData();
    expect(
      data.edges.find((e) => e.id === "e1")?.data?.observationPointIds,
    ).toEqual(["cam-b"]);
  });

  it("紐づけ済みの観測点は使用中として集約される", () => {
    const { result } = renderHook(() => useGraphViewer(initialGraph()));

    act(() => {
      result.current.links.onLinkNode("n1", ["cam-a"]);
    });
    act(() => {
      result.current.links.onLinkEdge("e1", ["cam-b"]);
    });

    const { nodes, edges } = result.current.graph;
    expect(collectObservationPointIds(nodes, edges)).toEqual(
      new Set(["cam-a", "cam-b"]),
    );
  });

  it("紐づけを解除できる", () => {
    const { result } = renderHook(() => useGraphViewer(initialGraph()));

    act(() => {
      result.current.links.onLinkNode("n1", ["cam-a"]);
    });
    act(() => {
      result.current.links.onLinkNode("n1", []);
    });

    // 空配列は保存用データに載せない
    expect(
      result.current.getGraphData().nodes.find((n) => n.id === "n1")?.data
        .observationPointIds,
    ).toBeUndefined();
  });
});

describe("useGraphViewer: グラフ構造", () => {
  it("キャンバスに構造編集（editing）のハンドラを渡さない", () => {
    const { result } = renderHook(() => useGraphViewer(initialGraph()));

    expect("editing" in result.current.canvas).toBe(false);
  });

  it("紐づけを変えてもポイント・ルートの構成は変わらない", () => {
    const { result } = renderHook(() => useGraphViewer(initialGraph()));

    act(() => {
      result.current.links.onLinkNode("n1", ["cam-a"]);
    });

    const data = result.current.getGraphData();
    expect(data.nodes.map((n) => n.id)).toEqual(["n1", "n2"]);
    expect(data.edges.map((e) => e.id)).toEqual(["e1"]);
    expect(data.nodes.map((n) => n.position)).toEqual([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ]);
  });
});

describe("useGraphViewer: 選択", () => {
  it("選択したポイント / ルートが紐づけパネルへ渡される", () => {
    const { result } = renderHook(() => useGraphViewer(initialGraph()));

    expect(result.current.links.selectedNode).toBeUndefined();
    expect(result.current.links.selectedEdge).toBeUndefined();

    act(() => {
      result.current.canvas.onSelectNode("n2");
    });
    expect(result.current.links.selectedNode?.id).toBe("n2");
    expect(result.current.links.selectedEdge).toBeUndefined();

    act(() => {
      result.current.canvas.onSelectEdge("e1");
    });
    expect(result.current.links.selectedNode).toBeUndefined();
    expect(result.current.links.selectedEdge?.id).toBe("e1");

    act(() => {
      result.current.canvas.onClearSelection();
    });
    expect(result.current.links.selectedNode).toBeUndefined();
    expect(result.current.links.selectedEdge).toBeUndefined();
  });
});
