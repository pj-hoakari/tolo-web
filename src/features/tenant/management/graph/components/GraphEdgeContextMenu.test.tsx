// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GraphEdgeType, GraphNodeType } from "../type";
import { GraphEdgeContextMenu } from "./GraphEdgeContextMenu";

const nodes: GraphNodeType[] = [
  {
    id: "n1",
    type: "graph",
    position: { x: 0, y: 0 },
    data: { label: "始点", nodeType: "GOAL" },
  },
  {
    id: "n2",
    type: "graph",
    position: { x: 300, y: 0 },
    data: { label: "終点", nodeType: "GOAL" },
  },
];

function edge(direction: "both" | "oneway"): GraphEdgeType {
  return {
    id: "e1",
    type: "graph",
    source: "n1",
    target: "n2",
    data: { direction },
  };
}

describe("GraphEdgeContextMenu", () => {
  it("両方向通行のエッジを片側通行に切り替える", () => {
    const onSetDirection = vi.fn();
    const onClose = vi.fn();
    const currentEdge = edge("both");

    render(
      <GraphEdgeContextMenu
        edge={currentEdge}
        nodes={nodes}
        edges={[currentEdge]}
        position={{ x: 100, y: 100 }}
        onSetDirection={onSetDirection}
        onReverse={vi.fn()}
        onDelete={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(
      screen.getByRole("menuitem", {
        name: "片側通行にする（始点 → 終点）",
      }),
    );

    expect(onSetDirection).toHaveBeenCalledWith("e1", "oneway");
    expect(onClose).toHaveBeenCalled();
  });

  it("片側通行のエッジでは向きを反転できる", () => {
    const onReverse = vi.fn();
    const currentEdge = edge("oneway");

    render(
      <GraphEdgeContextMenu
        edge={currentEdge}
        nodes={nodes}
        edges={[currentEdge]}
        position={{ x: 100, y: 100 }}
        onSetDirection={vi.fn()}
        onReverse={onReverse}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("menuitem", { name: "向きを反転（終点 → 始点）" }),
    );

    expect(onReverse).toHaveBeenCalledWith("e1");
  });

  it("destructive 色のメニューからエッジを削除できる", () => {
    const onDelete = vi.fn();
    const currentEdge = edge("both");

    render(
      <GraphEdgeContextMenu
        edge={currentEdge}
        nodes={nodes}
        edges={[currentEdge]}
        position={{ x: 100, y: 100 }}
        onSetDirection={vi.fn()}
        onReverse={vi.fn()}
        onDelete={onDelete}
        onClose={vi.fn()}
      />,
    );

    const deleteItem = screen.getByRole("menuitem", {
      name: "このルートを削除",
    });
    expect(deleteItem.classList.contains("text-destructive")).toBe(true);
    fireEvent.click(deleteItem);

    expect(onDelete).toHaveBeenCalledWith("e1");
  });

  it("メニュー名に対象ルートの両端ポイント名を含む", () => {
    const currentEdge = edge("both");

    render(
      <GraphEdgeContextMenu
        edge={currentEdge}
        nodes={nodes}
        edges={[currentEdge]}
        position={{ x: 100, y: 100 }}
        onSetDirection={vi.fn()}
        onReverse={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("menu", { name: "ルート「始点 → 終点」の操作" }),
    ).toBeTruthy();
  });
});
