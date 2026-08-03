// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GraphNodeType } from "../type";
import { GraphNodeContextMenu } from "./GraphNodeContextMenu";

const node: GraphNodeType = {
  id: "n1",
  type: "graph",
  position: { x: 0, y: 0 },
  data: { label: "ポイント 1", nodeType: "GOAL" },
};

describe("GraphNodeContextMenu", () => {
  it("ノードタイプを変更できる", () => {
    const onSetType = vi.fn();
    const onClose = vi.fn();

    render(
      <GraphNodeContextMenu
        node={node}
        nodes={[node]}
        edges={[]}
        position={{ x: 100, y: 100 }}
        onSetType={onSetType}
        onStartEdgeCreation={vi.fn()}
        onDelete={vi.fn()}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("タイプを変更")).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "通過のみ" }));

    expect(onSetType).toHaveBeenCalledWith("n1", "TRANSIT_ONLY");
    expect(onClose).toHaveBeenCalled();
  });

  it("destructive 色のメニューからノードを削除できる", () => {
    const onDelete = vi.fn();

    render(
      <GraphNodeContextMenu
        node={node}
        nodes={[node]}
        edges={[]}
        position={{ x: 100, y: 100 }}
        onSetType={vi.fn()}
        onStartEdgeCreation={vi.fn()}
        onDelete={onDelete}
        onClose={vi.fn()}
      />,
    );

    const deleteItem = screen.getByRole("menuitem", {
      name: "このポイントを削除",
    });
    expect(deleteItem.classList.contains("text-destructive")).toBe(true);
    fireEvent.click(deleteItem);

    expect(onDelete).toHaveBeenCalledWith("n1");
  });

  it("このポイントを始点にルート追加モードを開始できる", () => {
    const onStartEdgeCreation = vi.fn();
    const onClose = vi.fn();

    render(
      <GraphNodeContextMenu
        node={node}
        nodes={[node]}
        edges={[]}
        position={{ x: 100, y: 100 }}
        onSetType={vi.fn()}
        onStartEdgeCreation={onStartEdgeCreation}
        onDelete={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(
      screen.getByRole("menuitem", { name: "このポイントからルートを追加" }),
    );

    expect(onStartEdgeCreation).toHaveBeenCalledWith("n1");
    expect(onClose).toHaveBeenCalled();
  });
});
