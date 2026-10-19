// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { Connection } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import type {
  GraphCanvasNode,
  GraphData,
  GraphEdgeType,
  GraphNodeType,
  HandleSide,
} from "../type";
import { isExternalNode, isGroupNode, isPointNode } from "../type";
import { absolutePositionOf } from "../utils/groups";
import { parseHandleId } from "../utils/handles";
import { collectObservationPointIds } from "../utils/observationPoints";
import { useGraphEditor } from "./useGraphEditor";

const SIDES: HandleSide[] = ["top", "right", "bottom", "left"];

function node(id: string, x: number, y: number): GraphNodeType {
  return {
    id,
    type: "graph",
    position: { x, y },
    data: { labels: { ja: id }, nodeType: "GOAL" },
  };
}

function edge(id: string, source: string, target: string): GraphEdgeType {
  return { id, source, target, type: "graph", data: { direction: "both" } };
}

function connection(source: string, target: string): Connection {
  return { source, target, sourceHandle: null, targetHandle: null };
}

function slotsOf(nodes: GraphCanvasNode[], nodeId: string, side: HandleSide) {
  const found = nodes.find((n) => n.id === nodeId);
  if (!found || !isPointNode(found)) return [];
  return found.data.handles?.[side] ?? [];
}

describe("useGraphEditor: 同一ポイント間の複数ルート", () => {
  it("同じポイント間で　onConnect を繰り返すと独立したルートが増える", () => {
    const initial: GraphData = {
      nodes: [node("n1", 0, 0), node("n2", 300, 0)],
      edges: [],
    };
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });

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
    const { result } = renderHook(() => useGraphEditor(initial()), {
      wrapper: IntlTestProvider,
    });
    for (const side of SIDES) {
      expect(slotsOf(result.current.canvas.nodes, "n1", side)).toEqual([]);
    }
  });

  it("接続を追加すると端点が増え、削除すると減る", () => {
    const { result } = renderHook(() => useGraphEditor(initial()), {
      wrapper: IntlTestProvider,
    });

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
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });

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
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });

    act(() => {
      result.current.canvas.editing.onSetNodeType("n1", "TRANSIT_ONLY");
    });

    const first = result.current.canvas.nodes[0];
    expect(isPointNode(first) && first.data.nodeType).toBe("TRANSIT_ONLY");
  });
});

describe("useGraphEditor: ノード内ラベル編集", () => {
  it("ラベルを更新できる", () => {
    const initial: GraphData = {
      nodes: [node("n1", 0, 0)],
      edges: [],
    };
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });

    act(() => {
      result.current.canvas.editing.onSetNodeLabel("n1", "エントランス");
    });

    expect(result.current.canvas.nodes[0].data.label).toBe("エントランス");
  });
});

describe("useGraphEditor: ラベルの多言語編集", () => {
  it("編集言語を切り替えると、その言語のラベルで表示・編集される", () => {
    const initial: GraphData = {
      nodes: [
        {
          ...node("n1", 0, 0),
          data: { labels: { ja: "入口", en: "Entrance" }, nodeType: "GOAL" },
        },
      ],
      edges: [],
    };
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });

    // 既定の編集言語は UI の表示言語（テストでは ja）
    expect(result.current.toolbar.labelLocale).toBe("ja");
    expect(result.current.canvas.nodes[0].data.label).toBe("入口");
    expect(result.current.toolbar.labelCounts).toEqual({ ja: 1, en: 1 });

    act(() => {
      result.current.toolbar.onChangeLabelLocale("en");
    });
    expect(result.current.canvas.nodes[0].data.label).toBe("Entrance");

    // 編集は選択中の言語のラベルにだけ反映される
    act(() => {
      result.current.canvas.editing.onSetNodeLabel("n1", "Gate");
    });
    const first = result.current
      .getGraphData()
      .nodes.filter((n) => !isExternalNode(n))[0];
    expect(isPointNode(first) && first.data.labels).toEqual({
      ja: "入口",
      en: "Gate",
    });
  });

  it("選択中の言語にラベルが無いポイントは他言語へフォールバック表示する", () => {
    const initial: GraphData = { nodes: [node("n1", 0, 0)], edges: [] };
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });

    act(() => {
      result.current.toolbar.onChangeLabelLocale("en");
    });

    const first = result.current.canvas.nodes[0];
    expect(first.data.label).toBe("n1");
    expect(isPointNode(first) && first.data.labelIsFallback).toBe(true);
  });

  it("新しいポイントの初期ラベルは編集中の言語にだけ設定される", () => {
    const { result } = renderHook(
      () => useGraphEditor({ nodes: [], edges: [] }),
      { wrapper: IntlTestProvider },
    );

    act(() => {
      result.current.toolbar.onChangeLabelLocale("en");
    });
    act(() => {
      result.current.canvas.editing.onAddNodeAtPosition({ x: 0, y: 0 });
    });

    const first = result.current
      .getGraphData()
      .nodes.filter((n) => !isExternalNode(n))[0];
    // メッセージはテスト用 Provider（ja）のまま、キーは編集中の言語になる
    expect(isPointNode(first) && first.data.labels).toEqual({
      en: "ポイント 1",
    });
  });

  it("グループのラベルもポイントと同じ編集言語で更新される", () => {
    const initial: GraphData = {
      nodes: [
        {
          id: "g1",
          type: "graphGroup",
          position: { x: 0, y: 0 },
          width: 400,
          height: 300,
          data: { labels: { ja: "1F" } },
        },
      ],
      edges: [],
    };
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });

    // グループもラベル設定状況の分母・分子に数える
    expect(result.current.toolbar.labelCounts).toEqual({ ja: 1 });
    expect(result.current.toolbar.labelTargetCount).toBe(1);

    act(() => {
      result.current.toolbar.onChangeLabelLocale("en");
    });
    // 英語のラベルが無いので日本語へフォールバック表示する
    expect(result.current.canvas.nodes[0].data.label).toBe("1F");
    expect(result.current.canvas.nodes[0].data.labelIsFallback).toBe(true);

    act(() => {
      result.current.canvas.editing.onSetNodeLabel("g1", "Floor 1");
    });

    const group = result.current.getGraphData().nodes[0];
    expect(isGroupNode(group) && group.data.labels).toEqual({
      ja: "1F",
      en: "Floor 1",
    });
    expect(result.current.canvas.nodes[0].data.label).toBe("Floor 1");
  });
});

describe("useGraphEditor: グローバルコンテキスト操作", () => {
  it("指定した位置にノードを追加できる", () => {
    const initial: GraphData = { nodes: [], edges: [] };
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });

    act(() => {
      result.current.canvas.editing.onAddNodeAtPosition({ x: 420, y: 180 });
    });

    expect(
      result.current.canvas.nodes.find((n) => !isExternalNode(n)),
    ).toMatchObject({
      position: { x: 420, y: 180 },
      data: { label: "ポイント 1", nodeType: "GOAL_TRANSIT_MIXED" },
    });
  });
});

describe("useGraphEditor: コンテキストメニューからの削除", () => {
  const initial = (): GraphData => ({
    nodes: [node("n1", 0, 0), node("n2", 300, 0)],
    edges: [edge("e1", "n1", "n2")],
  });

  it("エッジを削除できる", () => {
    const { result } = renderHook(() => useGraphEditor(initial()), {
      wrapper: IntlTestProvider,
    });

    act(() => {
      result.current.canvas.editing.onDeleteEdge("e1");
    });

    expect(result.current.canvas.edges).toEqual([]);
  });

  it("ノードを削除すると接続エッジも削除する", () => {
    const { result } = renderHook(() => useGraphEditor(initial()), {
      wrapper: IntlTestProvider,
    });

    act(() => {
      result.current.canvas.editing.onDeleteNode("n1");
    });

    expect(result.current.canvas.nodes.map((node) => node.id)).toEqual([
      "n2",
      "external",
    ]);
    expect(result.current.canvas.edges).toEqual([]);
  });
});

describe("useGraphEditor: ポイント移動によるハンドル接続位置の変化", () => {
  it("ノードを移動すると接続辺が変わる", () => {
    const initial: GraphData = {
      nodes: [node("n1", 0, 0), node("n2", 300, 0)],
      edges: [edge("e1", "n1", "n2")],
    };
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });

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
          labels: { ja: "n1" },
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
    const { result } = renderHook(() => useGraphEditor(linkedGraph()), {
      wrapper: IntlTestProvider,
    });

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
    const { result } = renderHook(() => useGraphEditor(linkedGraph()), {
      wrapper: IntlTestProvider,
    });

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

describe("useGraphEditor: グループ（論理グルーピング）", () => {
  it("グループ内の位置に追加したポイントはグループに属する", () => {
    const initial: GraphData = {
      nodes: [
        {
          id: "g1",
          type: "graphGroup",
          position: { x: 100, y: 100 },
          width: 400,
          height: 300,
          data: { labels: { ja: "1F" } },
        },
      ],
      edges: [],
    };
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });

    act(() => {
      // グループの内側（絶対座標）
      result.current.canvas.editing.onAddNodeAtPosition({ x: 200, y: 200 });
    });

    const nodes = result.current.canvas.nodes;
    const added = nodes.find((n) => isPointNode(n) && !isExternalNode(n));
    expect(added?.parentId).toBe("g1");
    // 親相対に変換され、グループの自動フィット後も絶対位置は変わらない
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(added && absolutePositionOf(added, byId)).toEqual({
      x: 200,
      y: 200,
    });
  });

  it("グループを指定して追加したポイントは、位置に関わらずそのグループに属する", () => {
    const initial: GraphData = {
      nodes: [
        {
          id: "g1",
          type: "graphGroup",
          position: { x: 100, y: 100 },
          width: 400,
          height: 300,
          data: { labels: { ja: "1F" } },
        },
      ],
      edges: [],
    };
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });

    act(() => {
      result.current.canvas.editing.onAddNodeAtPosition(
        { x: 200, y: 200 },
        "GOAL",
        "g1",
      );
    });

    const added = result.current.canvas.nodes.find(
      (n) => isPointNode(n) && !isExternalNode(n),
    );
    expect(added?.parentId).toBe("g1");
  });

  it("グループを指定して追加したグループはネストする", () => {
    const initial: GraphData = {
      nodes: [
        {
          id: "g1",
          type: "graphGroup",
          position: { x: 100, y: 100 },
          width: 400,
          height: 300,
          data: { labels: { ja: "1F" } },
        },
      ],
      edges: [],
    };
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });

    act(() => {
      result.current.canvas.editing.onAddGroupAtPosition(
        { x: 200, y: 200 },
        "g1",
      );
    });

    const nodes = result.current.canvas.nodes;
    const added = nodes.find((n) => n.id !== "g1" && !isExternalNode(n));
    expect(added?.parentId).toBe("g1");
    // 親相対へ変換され、絶対位置はクリック位置のまま
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(added && absolutePositionOf(added, byId)).toEqual({
      x: 200,
      y: 200,
    });
  });

  it("グループを削除しても中のポイントは残り、トップレベルへ戻る", () => {
    const initial: GraphData = {
      nodes: [
        {
          id: "g1",
          type: "graphGroup",
          position: { x: 100, y: 100 },
          width: 400,
          height: 300,
          data: { labels: { ja: "1F" } },
        },
        {
          id: "n1",
          type: "graph",
          parentId: "g1",
          position: { x: 50, y: 60 },
          data: { labels: { ja: "ポイント" }, nodeType: "GOAL_TRANSIT_MIXED" },
        },
      ],
      edges: [],
    };
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });

    act(() => {
      result.current.canvas.editing.onDeleteNode("g1");
    });

    const nodes = result.current.canvas.nodes;
    expect(nodes.map((n) => n.id)).toEqual(["n1", "external"]);
    expect(nodes[0].parentId).toBeUndefined();
    expect(nodes[0].position).toEqual({ x: 150, y: 160 });
  });

  it("ドラッグ終了時にグループの外へ出すと所属が解除される", () => {
    const initial: GraphData = {
      nodes: [
        {
          id: "g1",
          type: "graphGroup",
          position: { x: 100, y: 100 },
          width: 400,
          height: 300,
          data: { labels: { ja: "1F" } },
        },
        {
          id: "n1",
          type: "graph",
          parentId: "g1",
          position: { x: 50, y: 60 },
          data: { labels: { ja: "ポイント" }, nodeType: "GOAL_TRANSIT_MIXED" },
        },
      ],
      edges: [],
    };
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });

    // グループ範囲外（相対座標で大きく右下）へ移動してからドロップ
    act(() => {
      result.current.canvas.onNodesChange([
        {
          id: "n1",
          type: "position",
          position: { x: 700, y: 700 },
          dragging: false,
        },
      ]);
    });
    act(() => {
      result.current.canvas.editing.onNodeDragStop(["n1"]);
    });

    const moved = result.current.canvas.nodes.find((n) => n.id === "n1");
    expect(moved?.parentId).toBeUndefined();
    // 絶対座標 = 旧親(100,100) + 相対(700,700)
    expect(moved?.position).toEqual({ x: 800, y: 800 });
  });

  it("グループはルートの端点にできない", () => {
    const initial: GraphData = {
      nodes: [
        {
          id: "g1",
          type: "graphGroup",
          position: { x: 500, y: 500 },
          width: 200,
          height: 200,
          data: { labels: { ja: "1F" } },
        },
        node("n1", 0, 0),
      ],
      edges: [],
    };
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });

    expect(
      result.current.canvas.editing.isValidConnection(connection("n1", "g1")),
    ).toBe(false);

    act(() => {
      result.current.canvas.editing.onConnect(connection("n1", "g1"));
    });
    expect(result.current.canvas.edges).toHaveLength(0);
  });
});

describe("useGraphEditor: 自動整列", () => {
  it("ツールバーの onAutoAlign で接続順に沿ってノードが整列される", () => {
    // 全体としては左→右の配置だが、縦位置はばらばらに置く
    const initial: GraphData = {
      nodes: [node("n1", 0, 300), node("n2", 300, 0), node("n3", 600, 150)],
      edges: [edge("e1", "n1", "n2"), edge("e2", "n2", "n3")],
    };
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });

    act(() => {
      result.current.toolbar.onAutoAlign();
    });

    const positions = new Map(
      result.current.graph.nodes.map((n) => [n.id, n.position]),
    );
    const n1 = positions.get("n1");
    const n2 = positions.get("n2");
    const n3 = positions.get("n3");
    if (!n1 || !n2 || !n3) throw new Error("node not found");

    // 接続順に左から右へ並び、縦位置が揃う
    expect(n1.x).toBeLessThan(n2.x);
    expect(n2.x).toBeLessThan(n3.x);
    expect(n1.y).toBe(n2.y);
    expect(n2.y).toBe(n3.y);
  });
});

describe("useGraphEditor: 外部ポイント", () => {
  it("外部ポイントの無いグラフには 1 つ追加され、削除できない", () => {
    const initial: GraphData = { nodes: [node("n1", 0, 0)], edges: [] };
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });

    const externals = () => result.current.canvas.nodes.filter(isExternalNode);
    expect(externals()).toHaveLength(1);
    expect(externals()[0].data.label).toBe("外部");

    act(() => {
      result.current.canvas.editing.onDeleteNode(externals()[0].id);
    });

    expect(externals()).toHaveLength(1);
  });

  it("最後の外部ポイントは削除できないが、2 つ目を追加すればどちらかは削除できる", () => {
    const initial: GraphData = { nodes: [node("n1", 0, 0)], edges: [] };
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });
    const externals = () => result.current.canvas.nodes.filter(isExternalNode);

    act(() => {
      result.current.canvas.editing.onAddNodeAtPosition(
        { x: 500, y: 0 },
        "EXTERNAL",
      );
    });
    expect(externals()).toHaveLength(2);
    expect(externals()[1].data.labels).toEqual({});

    act(() => {
      result.current.canvas.editing.onDeleteNode(externals()[0].id);
    });
    expect(externals()).toHaveLength(1);

    act(() => {
      result.current.canvas.editing.onDeleteNode(externals()[0].id);
    });
    expect(externals()).toHaveLength(1);
  });

  it("キーボード削除で外部ポイントをすべて選んでも 1 つは残る", async () => {
    const initial: GraphData = { nodes: [node("n1", 0, 0)], edges: [] };
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });
    act(() => {
      result.current.canvas.editing.onAddNodeAtPosition(
        { x: 500, y: 0 },
        "EXTERNAL",
      );
    });
    const externals = result.current.canvas.nodes.filter(isExternalNode);

    const allowed = await result.current.canvas.editing.onBeforeDelete({
      nodes: externals,
      edges: [],
    });

    expect(allowed).toEqual({ nodes: [externals[1]], edges: [] });
  });

  it("外部ポイント同士は接続できない", () => {
    const initial: GraphData = { nodes: [node("n1", 0, 0)], edges: [] };
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });
    act(() => {
      result.current.canvas.editing.onAddNodeAtPosition(
        { x: 500, y: 0 },
        "EXTERNAL",
      );
    });
    const [x1, x2] = result.current.canvas.nodes.filter(isExternalNode);

    expect(
      result.current.canvas.editing.isValidConnection(connection(x1.id, x2.id)),
    ).toBe(false);
    expect(
      result.current.canvas.editing.isValidConnection(connection(x1.id, "n1")),
    ).toBe(true);
  });

  it("グループの中を指定しても外部ポイントはグループに入らない", () => {
    const initial: GraphData = {
      nodes: [
        {
          id: "g1",
          type: "graphGroup",
          position: { x: 0, y: 0 },
          width: 400,
          height: 300,
          data: { labels: {} },
        },
      ],
      edges: [],
    };
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });

    act(() => {
      result.current.canvas.editing.onAddNodeAtPosition(
        { x: 100, y: 100 },
        "EXTERNAL",
        "g1",
      );
    });

    const added = result.current.canvas.nodes
      .filter(isExternalNode)
      .find((n) => n.id !== "external");
    expect(added?.parentId).toBeUndefined();
    expect(added?.position).toEqual({ x: 100, y: 100 });
  });
});

describe("useGraphEditor: 複数選択", () => {
  const initial = (): GraphData => ({
    nodes: [
      node("n1", 0, 0),
      node("n2", 300, 0),
      {
        id: "g1",
        type: "graphGroup",
        position: { x: 1000, y: 1000 },
        width: 480,
        height: 320,
        data: { labels: { ja: "group" } },
      },
    ],
    edges: [edge("e1", "n1", "n2")],
  });
  it("selected を選択情報と件数の情報源にし、単体プロパティを隠す", () => {
    const { result } = renderHook(() => useGraphEditor(initial()), {
      wrapper: IntlTestProvider,
    });
    act(() => {
      result.current.canvas.onNodesChange([
        { type: "select", id: "n1", selected: true },
        { type: "select", id: "g1", selected: true },
      ]);
      result.current.canvas.onEdgesChange([
        { type: "select", id: "e1", selected: true },
      ]);
    });
    expect(result.current.selection).toEqual({
      nodeIds: ["n1", "g1"],
      edgeIds: ["e1"],
    });
    expect(result.current.properties.selectionCounts).toEqual({
      nodes: 1,
      groups: 1,
      edges: 1,
    });
    expect(result.current.properties.selectedNode).toBeUndefined();
    expect(result.current.properties.selectedEdge).toBeUndefined();
    expect(
      result.current
        .getGraphData()
        .nodes.every((n) => n.selected === undefined),
    ).toBe(true);
    expect(
      result.current
        .getGraphData()
        .edges.every((e) => e.selected === undefined),
    ).toBe(true);
    act(() => result.current.canvas.onSelectEdge("e1"));
    expect(result.current.selection).toEqual({ nodeIds: [], edgeIds: ["e1"] });
    expect(result.current.canvas.nodes.every((n) => !n.selected)).toBe(true);
    expect(result.current.properties.selectedEdge?.id).toBe("e1");
    act(() => result.current.canvas.onClearSelection());
    expect(result.current.selection).toEqual({ nodeIds: [], edgeIds: [] });
    expect(result.current.canvas.edges.every((e) => !e.selected)).toBe(true);
  });
  it("削除した要素は選択から消え、残った1件のプロパティを表示する", () => {
    const { result } = renderHook(() => useGraphEditor(initial()), {
      wrapper: IntlTestProvider,
    });
    act(() =>
      result.current.canvas.onNodesChange([
        { type: "select", id: "n1", selected: true },
        { type: "select", id: "n2", selected: true },
      ]),
    );
    act(() =>
      result.current.canvas.onNodesChange([{ type: "remove", id: "n1" }]),
    );
    expect(result.current.selection.nodeIds).toEqual(["n2"]);
    expect(result.current.properties.selectedNode?.id).toBe("n2");
  });
  it("追加した要素だけを selected にする", () => {
    const { result } = renderHook(() => useGraphEditor(initial()), {
      wrapper: IntlTestProvider,
    });
    act(() => result.current.canvas.onSelectEdge("e1"));
    act(() =>
      result.current.canvas.editing.onAddNodeAtPosition({ x: 800, y: 0 }),
    );
    expect(result.current.selection.nodeIds).toHaveLength(1);
    expect(result.current.selection.edgeIds).toEqual([]);
    expect(result.current.properties.selectedNode?.selected).toBe(true);
  });
});

describe("useGraphEditor: 選択要素の操作", () => {
  const initial = (): GraphData => ({
    nodes: [
      {
        id: "g",
        type: "graphGroup",
        position: { x: 500, y: 500 },
        width: 480,
        height: 320,
        data: { labels: { ja: "parent" } },
      },
      { ...node("a", 100, 100), parentId: "g", selected: true },
      { ...node("b", 300, 200), parentId: "g", selected: true },
    ],
    edges: [{ ...edge("e", "a", "b"), selected: true }],
  });
  it("選択ポイントを編集中の言語でグループ化し、新しいグループの単体プロパティを表示する", () => {
    const { result } = renderHook(() => useGraphEditor(initial()), {
      wrapper: IntlTestProvider,
    });
    expect(result.current.properties.groupSelectionError).toBeNull();
    act(() => result.current.toolbar.onChangeLabelLocale("en"));
    act(() => result.current.properties.onGroupSelected());
    const selected = result.current.properties.selectedNode;
    expect(selected?.type).toBe("graphGroup");
    expect(selected?.parentId).toBe("g");
    expect(selected?.data.labels.en).toBeDefined();
    expect(selected?.data.labels.ja).toBeUndefined();
    expect(result.current.selection).toEqual({
      nodeIds: [selected?.id],
      edgeIds: [],
    });
    expect(result.current.graph.edges).toHaveLength(1);
    expect(
      result.current
        .getGraphData()
        .nodes.every((n) => n.selected === undefined),
    ).toBe(true);
  });
  it("選択要素を一括削除し、選択件数とプロパティを更新する", () => {
    const { result } = renderHook(() => useGraphEditor(initial()), {
      wrapper: IntlTestProvider,
    });
    expect(result.current.properties.canDeleteSelected).toBe(true);
    act(() => result.current.properties.onDeleteSelected());
    expect(
      result.current.graph.nodes.some((n) => n.id === "a" || n.id === "b"),
    ).toBe(false);
    expect(result.current.graph.nodes.some((n) => n.id === "g")).toBe(true);
    expect(result.current.graph.edges).toHaveLength(0);
    expect(result.current.selection).toEqual({ nodeIds: [], edgeIds: [] });
    expect(result.current.properties.canDeleteSelected).toBe(false);
  });
  it("所属が違うと無効で、ハンドラを直接呼んでもグループを追加しない", () => {
    const graph = initial();
    graph.nodes[2] = { ...graph.nodes[2], parentId: undefined };
    const { result } = renderHook(() => useGraphEditor(graph), {
      wrapper: IntlTestProvider,
    });
    expect(result.current.properties.groupSelectionError).toBe(
      "differentParents",
    );
    const before = result.current.getGraphData();
    act(() => result.current.properties.onGroupSelected());
    expect(result.current.getGraphData()).toEqual(before);
  });
});

describe("useGraphEditor: 一括プロパティ編集", () => {
  const initial = (): GraphData => ({
    nodes: [
      { ...node("a", 100, 100), selected: true },
      {
        ...node("b", 300, 100),
        selected: true,
        data: { labels: { ja: "b" }, nodeType: "TRANSIT_ONLY" },
      },
    ],
    edges: [{ ...edge("e", "a", "b"), selected: true }],
  });
  it("操作結果を通知し、選択と他のプロパティを保つ", () => {
    const { result } = renderHook(() => useGraphEditor(initial()), {
      wrapper: IntlTestProvider,
    });
    const selection = result.current.selection;
    const labels = result.current
      .getGraphData()
      .nodes.map((n) => n.data.labels);
    act(() =>
      result.current.properties.onSetSelectedNodeFlag("destination", true),
    );
    expect(result.current.properties.bulkResult).toMatchObject({
      changedCount: 0,
      skippedCount: 1,
    });
    expect(result.current.selection).toEqual(selection);
    act(() =>
      result.current.properties.onSetSelectedNodeFlag("destination", false),
    );
    expect(
      result.current.graph.nodes.filter(isPointNode).find((n) => n.id === "a")
        ?.data.nodeType,
    ).toBe("GOAL_TRANSIT_MIXED");
    expect(result.current.properties.bulkResult).toMatchObject({
      changedCount: 1,
      skippedCount: 0,
    });
    act(() => result.current.properties.onSetSelectedEdgeDirection("oneway"));
    expect(result.current.graph.edges[0].data?.direction).toBe("oneway");
    act(() => result.current.properties.onReverseSelectedEdges());
    expect(result.current.graph.edges[0]).toMatchObject({
      source: "b",
      target: "a",
    });
    expect(result.current.selection).toEqual(selection);
    expect(
      result.current.getGraphData().nodes.map((n) => n.data.labels),
    ).toEqual(labels);
  });
  it("選択変更後に結果をクリアし、元の選択に戻しても復活させない", () => {
    const { result } = renderHook(() => useGraphEditor(initial()), {
      wrapper: IntlTestProvider,
    });
    act(() => result.current.properties.onSetSelectedNodeFlag("dwell", true));
    expect(result.current.properties.bulkResult).not.toBeNull();
    act(() => result.current.canvas.onSelectNode("a"));
    expect(result.current.properties.bulkResult).toBeNull();
    act(() =>
      result.current.canvas.onNodesChange([
        { type: "select", id: "b", selected: true },
      ]),
    );
    act(() =>
      result.current.canvas.onEdgesChange([
        { type: "select", id: "e", selected: true },
      ]),
    );
    expect(result.current.properties.bulkResult).toBeNull();
  });
});

describe("useGraphEditor: 親子の移動バッチ", () => {
  const initial: GraphData = {
    nodes: [
      {
        id: "group",
        type: "graphGroup",
        position: { x: 100, y: 100 },
        width: 480,
        height: 320,
        data: { labels: {} },
      },
      { ...node("child", 90, 90), parentId: "group" },
    ],
    edges: [],
  };
  it("親子が同じドラッグバッチに含まれても子の相対位置を維持する", () => {
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });
    for (const dragging of [true, false]) {
      act(() =>
        result.current.canvas.onNodesChange([
          {
            type: "position",
            id: "group",
            position: { x: 110, y: 120 },
            dragging,
          },
          {
            type: "position",
            id: "child",
            position: { x: 100, y: 110 },
            dragging,
          },
        ]),
      );
      expect(
        result.current.canvas.nodes.find((n) => n.id === "child")?.position,
      ).toEqual({ x: 90, y: 90 });
    }
  });
  it("リサイズ時の子の位置補正はそのまま反映する", () => {
    const { result } = renderHook(() => useGraphEditor(initial), {
      wrapper: IntlTestProvider,
    });
    act(() =>
      result.current.canvas.onNodesChange([
        { type: "position", id: "group", position: { x: 110, y: 120 } },
        { type: "position", id: "child", position: { x: 80, y: 70 } },
      ]),
    );
    const child = result.current.canvas.nodes.find((n) => n.id === "child");
    expect(child?.position).toEqual({ x: 80, y: 70 });
    expect(
      absolutePositionOf(
        child as GraphCanvasNode,
        new Map(result.current.canvas.nodes.map((n) => [n.id, n])),
      ),
    ).toEqual({ x: 190, y: 190 });
  });
});

describe("useGraphEditor: プロパティパネルからのルート追加", () => {
  const initial = (): GraphData => ({
    nodes: [
      {
        id: "g",
        type: "graphGroup",
        position: { x: 0, y: 0 },
        width: 480,
        height: 320,
        data: { labels: {} },
      },
      node("a", 600, 0),
      node("b", 900, 0),
      {
        id: "x",
        type: "graph",
        position: { x: 0, y: 600 },
        data: { labels: {}, nodeType: "EXTERNAL" },
      },
      {
        id: "y",
        type: "graph",
        position: { x: 300, y: 600 },
        data: { labels: {}, nodeType: "EXTERNAL" },
      },
    ],
    edges: [],
  });

  it("選択中のポイントから接続できる終点だけを候補にする", () => {
    const { result } = renderHook(() => useGraphEditor(initial()), {
      wrapper: IntlTestProvider,
    });
    expect(result.current.properties.edgeTargets).toEqual([]);

    act(() => result.current.canvas.onSelectNode("a"));
    expect(result.current.properties.edgeTargets.map((t) => t.id)).toEqual([
      "b",
      "x",
      "y",
    ]);

    act(() => result.current.canvas.onSelectNode("x"));
    expect(result.current.properties.edgeTargets.map((t) => t.id)).toEqual([
      "a",
      "b",
    ]);

    act(() => result.current.canvas.onSelectNode("g"));
    expect(result.current.properties.edgeTargets).toEqual([]);
  });

  it("選択中のポイントを始点にルートを追加し、追加したルートを選択する", () => {
    const { result } = renderHook(() => useGraphEditor(initial()), {
      wrapper: IntlTestProvider,
    });
    act(() => result.current.canvas.onSelectNode("a"));
    act(() => result.current.properties.onAddEdge("b"));

    const edges = result.current.graph.edges;
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ source: "a", target: "b" });
    expect(result.current.selection).toEqual({
      nodeIds: [],
      edgeIds: [edges[0].id],
    });
  });
});
