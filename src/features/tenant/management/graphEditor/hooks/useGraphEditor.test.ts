// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { Connection } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import type {
  GraphData,
  GraphEdgeType,
  GraphNodeType,
  HandleSide,
} from "../type";
import { parseHandleId } from "../utils/handles";
import { collectObservationPointIds } from "../utils/observationPoints";
import { useGraphEditor } from "./useGraphEditor";

const SIDES: HandleSide[] = ["top", "right", "bottom", "left"];

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

function connection(source: string, target: string): Connection {
  return { source, target, sourceHandle: null, targetHandle: null };
}

function slotsOf(nodes: GraphNodeType[], nodeId: string, side: HandleSide) {
  return nodes.find((n) => n.id === nodeId)?.data.handles?.[side] ?? [];
}

function usedCount(nodes: GraphNodeType[], nodeId: string, side: HandleSide) {
  return slotsOf(nodes, nodeId, side).filter((s) => s.used).length;
}

function freeCount(nodes: GraphNodeType[], nodeId: string, side: HandleSide) {
  return slotsOf(nodes, nodeId, side).filter((s) => !s.used).length;
}

describe("useGraphEditor: 同一ポイント間の複数ルート", () => {
  it("同じポイント間で　onConnect を繰り返すと独立したルートが増える", () => {
    const initial: GraphData = {
      nodes: [node("n1", 0, 0), node("n2", 300, 0)],
      edges: [],
    };
    const { result } = renderHook(() => useGraphEditor(initial));

    expect(result.current.canvas.edges.length).toBe(0);

    act(() => {
      result.current.canvas.onConnect(connection("n1", "n2"));
    });
    expect(result.current.canvas.edges.length).toBe(1);

    // 同一ポイント間でも 2 本目が拒否されず追加される
    act(() => {
      result.current.canvas.onConnect(connection("n1", "n2"));
    });
    expect(result.current.canvas.edges.length).toBe(2);

    const edges = result.current.canvas.edges;

    // 2 本とも同じポイント間で、別 ID の独立ルート
    expect(edges.every((e) => e.source === "n1" && e.target === "n2")).toBe(
      true,
    );
    expect(new Set(edges.map((e) => e.id)).size).toBe(2);
  });
});

describe("useGraphEditor: 接続数によるハンドルの増減", () => {
  const initial = (): GraphData => ({
    nodes: [node("n1", 0, 0), node("n2", 300, 0)],
    edges: [],
  });

  it("接続が無いときは各辺に空きハンドルが1つ", () => {
    const { result } = renderHook(() => useGraphEditor(initial()));
    for (const side of SIDES) {
      const slots = slotsOf(result.current.canvas.nodes, "n1", side);
      expect(slots).toHaveLength(1);
      expect(slots[0].used).toBe(false);
    }
  });

  it("接続を追加するとハンドルが増え、削除すると減る（常に空き1）", () => {
    const { result } = renderHook(() => useGraphEditor(initial()));

    // 接続1: 使用済み1 + 空き
    act(() => {
      result.current.canvas.onConnect(connection("n1", "n2"));
    });
    expect(usedCount(result.current.canvas.nodes, "n1", "right")).toBe(1);
    expect(freeCount(result.current.canvas.nodes, "n1", "right")).toBe(1);

    // 2本目接続: 使用済み 1 → 2 + 空き
    act(() => {
      result.current.canvas.onConnect(connection("n1", "n2"));
    });
    expect(usedCount(result.current.canvas.nodes, "n1", "right")).toBe(2);
    expect(freeCount(result.current.canvas.nodes, "n1", "right")).toBe(1); // 常に空き1

    // 1本削除: 使用済み 2 → 1 + 空き
    const removedId = result.current.canvas.edges[0].id;
    act(() => {
      result.current.canvas.onSelectEdge(removedId);
    });
    act(() => {
      result.current.properties.onDelete();
    });
    expect(result.current.canvas.edges.length).toBe(1);
    expect(usedCount(result.current.canvas.nodes, "n1", "right")).toBe(1);
    expect(freeCount(result.current.canvas.nodes, "n1", "right")).toBe(1); // 常に空き1
  });
});

describe("useGraphEditor: ポイント移動によるハンドル接続位置の変化", () => {
  it("ノードを移動すると接続辺が変わる", () => {
    const initial: GraphData = {
      nodes: [node("n1", 0, 0), node("n2", 300, 0)],
      edges: [edge("e1", "n1", "n2")],
    };
    const { result } = renderHook(() => useGraphEditor(initial));

    // 水平配置 → 右左で接続
    const before = result.current.canvas.edges.find((e) => e.id === "e1");
    expect(parseHandleId(before?.sourceHandle)?.side).toBe("right");
    expect(parseHandleId(before?.targetHandle)?.side).toBe("left");

    // n2を真下へ移動 → 上下の接続に変わる
    act(() => {
      result.current.canvas.onNodesChange([
        {
          id: "n2",
          type: "position",
          position: { x: 0, y: 300 },
          dragging: false,
        },
      ]);
    });

    const after = result.current.canvas.edges.find((e) => e.id === "e1");
    expect(parseHandleId(after?.sourceHandle)?.side).toBe("bottom");
    expect(parseHandleId(after?.targetHandle)?.side).toBe("top");
  });
});

describe("useGraphEditor: 観測点の紐づけとグラフの整合", () => {
  const linkedGraph = (): GraphData => ({
    nodes: [
      {
        ...node("n1", 0, 0),
        data: {
          label: "n1",
          nodeType: "GOAL",
          observationPointIds: ["cam-1"],
        },
      },
      node("n2", 300, 0),
    ],
    edges: [
      {
        ...edge("e1", "n1", "n2"),
        data: { direction: "both", observationPointIds: ["cam-e1"] },
      },
    ],
  });

  it("ポイントを削除すると、本体と接続ルートの紐づけがグラフから消える", () => {
    const { result } = renderHook(() => useGraphEditor(linkedGraph()));

    act(() => {
      result.current.canvas.onSelectNode("n1");
    });
    act(() => {
      result.current.properties.onDelete();
    });

    const { nodes, edges } = result.current.getGraphData();
    expect(collectObservationPointIds(nodes, edges)).toEqual(new Set());
  });

  it("紐づけを張り替えるとグラフ側の紐づけも入れ替わる", () => {
    const { result } = renderHook(() => useGraphEditor(linkedGraph()));

    act(() => {
      result.current.properties.onUpdateNode("n1", {
        observationPointIds: ["cam-2"],
      });
    });

    const { nodes, edges } = result.current.getGraphData();
    expect(collectObservationPointIds(nodes, edges)).toEqual(
      new Set(["cam-2", "cam-e1"]),
    );
  });
});
