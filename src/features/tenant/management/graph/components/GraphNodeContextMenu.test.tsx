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
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("menuitemradio", { name: "通過のみ" }));

    expect(onSetType).toHaveBeenCalledWith("n1", "TRANSIT_ONLY");
    expect(onClose).toHaveBeenCalled();
  });
});
