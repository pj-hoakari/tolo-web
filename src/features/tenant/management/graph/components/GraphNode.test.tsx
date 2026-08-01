// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type NodeProps, ReactFlowProvider } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GraphNodeType } from "../type";
import { GraphNode, GraphNodeLabelEditingContext } from "./GraphNode";

const nodeProps = {
  id: "n1",
  data: { label: "ポイント 1", nodeType: "GOAL" },
  selected: false,
  isConnectable: false,
} as NodeProps<GraphNodeType>;

afterEach(cleanup);

describe("GraphNode", () => {
  it("文字幅にフィットするラベルを、ノードのサイズを変えずにポップアップ編集できる", () => {
    const onUpdate = vi.fn();

    render(
      <ReactFlowProvider>
        <GraphNodeLabelEditingContext.Provider value={onUpdate}>
          <GraphNode {...nodeProps} />
        </GraphNodeLabelEditingContext.Provider>
      </ReactFlowProvider>,
    );

    const labelButton = screen.getByRole("button", {
      name: "「ポイント 1」のラベルを編集",
    });
    expect(labelButton.classList.contains("w-fit")).toBe(true);
    expect(labelButton.classList.contains("w-full")).toBe(false);
    fireEvent.click(labelButton);

    const input = screen.getByRole("textbox", { name: "ポイントのラベル" });
    expect(document.activeElement).toBe(input);
    expect(input.closest(".absolute")).not.toBeNull();
    fireEvent.change(input, { target: { value: "エントランス" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onUpdate).toHaveBeenCalledWith("n1", "エントランス");
  });

  it("Escape で編集を取り消せる", () => {
    const onUpdate = vi.fn();

    render(
      <ReactFlowProvider>
        <GraphNodeLabelEditingContext.Provider value={onUpdate}>
          <GraphNode {...nodeProps} />
        </GraphNodeLabelEditingContext.Provider>
      </ReactFlowProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "「ポイント 1」のラベルを編集" }),
    );
    const input = screen.getByRole("textbox", { name: "ポイントのラベル" });
    fireEvent.change(input, { target: { value: "取り消す名前" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onUpdate).not.toHaveBeenCalled();
  });
});
