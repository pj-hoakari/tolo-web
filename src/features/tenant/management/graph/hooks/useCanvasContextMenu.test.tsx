// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GraphEdgeType, GraphNodeType } from "../type";
import { useCanvasContextMenu } from "./useCanvasContextMenu";

const node: GraphNodeType = {
  id: "n1",
  type: "graph",
  position: { x: 0, y: 0 },
  data: { label: "ポイント 1", nodeType: "GOAL" },
};

const edge: GraphEdgeType = {
  id: "e1",
  source: "n1",
  target: "n2",
  type: "graph",
  data: { direction: "both" },
};

function mouseEvent(x: number, y: number) {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    clientX: x,
    clientY: y,
  } as unknown as React.MouseEvent;
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ReactFlowProvider>{children}</ReactFlowProvider>
);

function renderMenu(callbacks?: {
  onSelectNode?: (id: string) => void;
  onSelectEdge?: (id: string) => void;
  onClearSelection?: () => void;
}) {
  return renderHook(
    () =>
      useCanvasContextMenu({
        nodes: [node],
        edges: [edge],
        onSelectNode: callbacks?.onSelectNode ?? vi.fn(),
        onSelectEdge: callbacks?.onSelectEdge ?? vi.fn(),
        onClearSelection: callbacks?.onClearSelection ?? vi.fn(),
      }),
    { wrapper },
  );
}

afterEach(cleanup);

describe("useCanvasContextMenu", () => {
  it("初期状態ではどのメニューも開いていない", () => {
    const { result } = renderMenu();
    expect(result.current.menu).toBeNull();
    expect(result.current.menuNode).toBeUndefined();
    expect(result.current.menuEdge).toBeUndefined();
    expect(result.current.canvasMenu).toBeUndefined();
  });

  it("ノードメニューを開くと対象を選択し、対象ノードを解決する", () => {
    const onSelectNode = vi.fn();
    const { result } = renderMenu({ onSelectNode });

    act(() => result.current.openNodeMenu(mouseEvent(10, 20), node));

    expect(onSelectNode).toHaveBeenCalledWith("n1");
    expect(result.current.menu).toMatchObject({
      kind: "node",
      elementId: "n1",
      x: 10,
      y: 20,
    });
    expect(result.current.menuNode).toBe(node);
    expect(result.current.menuEdge).toBeUndefined();
  });

  it("ノードメニューはグループ内への追加位置を持つ", () => {
    const { result } = renderMenu();

    act(() => result.current.openNodeMenu(mouseEvent(10, 20), node));

    expect(result.current.nodeMenu).toMatchObject({ kind: "node", x: 10 });
    expect(result.current.nodeMenu?.nodePosition).toBeDefined();
  });

  it("エッジメニューを開くと対象を選択し、対象エッジを解決する", () => {
    const onSelectEdge = vi.fn();
    const { result } = renderMenu({ onSelectEdge });

    act(() => result.current.openEdgeMenu(mouseEvent(30, 40), edge));

    expect(onSelectEdge).toHaveBeenCalledWith("e1");
    expect(result.current.menuEdge).toBe(edge);
    expect(result.current.menuNode).toBeUndefined();
  });

  it("背景メニューを開くと選択を解除し、ノード追加位置を持つ", () => {
    const onClearSelection = vi.fn();
    const { result } = renderMenu({ onClearSelection });

    act(() => result.current.openPaneMenu(mouseEvent(50, 60)));

    expect(onClearSelection).toHaveBeenCalled();
    expect(result.current.canvasMenu).toMatchObject({
      kind: "canvas",
      x: 50,
      y: 60,
    });
    expect(result.current.canvasMenu?.nodePosition).toBeDefined();
  });

  it("close でメニューを閉じる", () => {
    const { result } = renderMenu();

    act(() => result.current.openNodeMenu(mouseEvent(0, 0), node));
    act(() => result.current.close());

    expect(result.current.menu).toBeNull();
    expect(result.current.menuNode).toBeUndefined();
  });

  it("メニューを開いたまま対象が消えたときは対象を解決しない", () => {
    const { result, rerender } = renderHook(
      ({ nodes }: { nodes: GraphNodeType[] }) =>
        useCanvasContextMenu({
          nodes,
          edges: [],
          onSelectNode: vi.fn(),
          onSelectEdge: vi.fn(),
          onClearSelection: vi.fn(),
        }),
      { wrapper, initialProps: { nodes: [node] } },
    );

    act(() => result.current.openNodeMenu(mouseEvent(0, 0), node));
    expect(result.current.menuNode).toBe(node);

    rerender({ nodes: [] });
    expect(result.current.menuNode).toBeUndefined();
  });
});
