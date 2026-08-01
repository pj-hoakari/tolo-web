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

describe("useGraphEditor: 同一ポイント間の複数ルート", () => {
  it("同じポイント間で　onConnect を繰り返すと独立したルートが増える", () => {
    const initial: GraphData = {
      nodes: [node("n1", 0, 0), node("n2", 300, 0)],
      edges: [],
    };
    const { result } = renderHook(() => useGraphEditor(initial));

    expect(result.current.canvas.edges.length).toBe(0);

    act(() => {
      result.current.canvas.editing.onConnect(connection("n1", "n2"));
    });
    expect(result.current.canvas.edges.length).toBe(1);

    // 同一ポイント間でも 2 本目が拒否されず追加される
    act(() => {
      result.current.canvas.editing.onConnect(connection("n1", "n2"));
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

describe("useGraphEditor: 接続数によるエッジ端点の増減", () => {
  const initial = (): GraphData => ({
    nodes: [node("n1", 0, 0), node("n2", 300, 0)],
    edges: [],
  });

  it("接続が無いときは各辺にエッジ端点用ハンドルを作らない", () => {
    const { result } = renderHook(() => useGraphEditor(initial()));
    for (const side of SIDES) {
      expect(slotsOf(result.current.canvas.nodes, "n1", side)).toEqual([]);
    }
  });

  it("接続を追加すると端点が増え、削除すると減る", () => {
    const { result } = renderHook(() => useGraphEditor(initial()));

    act(() => {
      result.current.canvas.editing.onConnect(connection("n1", "n2"));
    });
    expect(slotsOf(result.current.canvas.nodes, "n1", "right")).toHaveLength(1);

    act(() => {
      result.current.canvas.editing.onConnect(connection("n1", "n2"));
    });
    expect(slotsOf(result.current.canvas.nodes, "n1", "right")).toHaveLength(2);

    const removedId = result.current.canvas.edges[0].id;
    act(() => {
      result.current.canvas.onSelectEdge(removedId);
    });
    act(() => {
      result.current.properties.onDelete();
    });
    expect(result.current.canvas.edges.length).toBe(1);
    expect(slotsOf(result.current.canvas.nodes, "n1", "right")).toHaveLength(1);
  });
});

describe("useGraphEditor: エッジ方向のコンテキスト操作", () => {
  it("片側通行への変更と向きの反転を行える", () => {
    const initial: GraphData = {
      nodes: [node("n1", 0, 0), node("n2", 300, 0)],
      edges: [edge("e1", "n1", "n2")],
    };
    const { result } = renderHook(() => useGraphEditor(initial));

    act(() => {
      result.current.canvas.editing.onSetEdgeDirection("e1", "oneway");
    });
    expect(result.current.canvas.edges[0].data?.direction).toBe("oneway");

    act(() => {
      result.current.canvas.editing.onReverseEdge("e1");
    });
    expect(result.current.canvas.edges[0]).toMatchObject({
      source: "n2",
      target: "n1",
    });
  });
});

describe("useGraphEditor: ノードタイプのコンテキスト操作", () => {
  it("ノードタイプを変更できる", () => {
    const initial: GraphData = {
      nodes: [node("n1", 0, 0)],
      edges: [],
    };
    const { result } = renderHook(() => useGraphEditor(initial));

    act(() => {
      result.current.canvas.editing.onSetNodeType("n1", "TRANSIT_ONLY");
    });

    expect(result.current.canvas.nodes[0].data.nodeType).toBe("TRANSIT_ONLY");
  });
});

describe("useGraphEditor: グローバルコンテキスト操作", () => {
  it("指定した位置にノードを追加できる", () => {
    const initial: GraphData = { nodes: [], edges: [] };
    const { result } = renderHook(() => useGraphEditor(initial));

    act(() => {
      result.current.canvas.editing.onAddNodeAtPosition({ x: 420, y: 180 });
    });

    expect(result.current.canvas.nodes[0]).toMatchObject({
      position: { x: 420, y: 180 },
      data: { label: "ポイント 1", nodeType: "GOAL" },
    });
  });
});

describe("useGraphEditor: コンテキストメニューからの削除", () => {
  const initial = (): GraphData => ({
    nodes: [node("n1", 0, 0), node("n2", 300, 0)],
    edges: [edge("e1", "n1", "n2")],
  });

  it("エッジを削除できる", () => {
    const { result } = renderHook(() => useGraphEditor(initial()));

    act(() => {
      result.current.canvas.editing.onDeleteEdge("e1");
    });

    expect(result.current.canvas.edges).toEqual([]);
  });

  it("ノードを削除すると接続エッジも削除する", () => {
    const { result } = renderHook(() => useGraphEditor(initial()));

    act(() => {
      result.current.canvas.editing.onDeleteNode("n1");
    });

    expect(result.current.canvas.nodes.map((node) => node.id)).toEqual(["n2"]);
    expect(result.current.canvas.edges).toEqual([]);
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
