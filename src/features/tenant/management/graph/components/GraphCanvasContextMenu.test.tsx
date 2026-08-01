// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GraphCanvasContextMenu } from "./GraphCanvasContextMenu";

describe("GraphCanvasContextMenu", () => {
  it("クリック位置にポイントを追加する", () => {
    const onAddNode = vi.fn();
    const onClose = vi.fn();

    render(
      <GraphCanvasContextMenu
        position={{ x: 100, y: 100 }}
        nodePosition={{ x: 420, y: 180 }}
        onAddNode={onAddNode}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "ポイントを追加" }));

    expect(onAddNode).toHaveBeenCalledWith({ x: 420, y: 180 });
    expect(onClose).toHaveBeenCalled();
  });
});
