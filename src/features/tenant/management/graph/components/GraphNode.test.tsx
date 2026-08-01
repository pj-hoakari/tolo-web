// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type NodeProps, ReactFlowProvider } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GraphNodeType } from "../type";
import {
  GraphNode,
  GraphNodeEasyConnectContext,
  GraphNodeLabelEditingContext,
} from "./GraphNode";

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

    const { container } = render(
      <ReactFlowProvider>
        <GraphNodeLabelEditingContext.Provider value={onUpdate}>
          <GraphNode {...nodeProps} />
        </GraphNodeLabelEditingContext.Provider>
      </ReactFlowProvider>,
    );

    const labelButton = screen.getByRole("button", {
      name: "「ポイント 1」のラベルを編集",
    });
    const frame = container.querySelector(".graph-node-frame");
    const badge = container.querySelector(".graph-node-type-badge");
    const badgeIcon = badge?.querySelector("svg");
    expect(frame?.classList.contains("bg-card")).toBe(true);
    expect(frame?.classList.contains("border-border")).toBe(true);
    expect(badge?.classList.contains("-top-1")).toBe(true);
    expect(badge?.classList.contains("-left-1")).toBe(true);
    expect(badge?.classList.contains("rounded-full")).toBe(true);
    expect(badge?.classList.contains("bg-card")).toBe(true);
    expect(badge?.classList.contains("shadow-sm")).toBe(false);
    expect(badgeIcon?.classList.contains("size-4")).toBe(true);
    expect(screen.getByText("目的地").parentElement).toBe(badge);
    expect(labelButton.classList.contains("w-fit")).toBe(true);
    expect(labelButton.classList.contains("w-full")).toBe(false);
    expect(labelButton.classList.contains("text-left")).toBe(true);
    expect(screen.getByText("目的地").classList.contains("text-[10px]")).toBe(
      true,
    );
    fireEvent.click(labelButton);

    const input = screen.getByRole("textbox", { name: "ポイントのラベル" });
    expect(document.activeElement).toBe(input);
    const popup = input.closest(".absolute");
    expect(popup).not.toBeNull();
    expect(popup?.classList.contains("top-1/2")).toBe(true);
    expect(popup?.classList.contains("left-1/2")).toBe(true);
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

  it("ルート追加モード中はノード全体を接続領域にする", () => {
    const { container } = render(
      <ReactFlowProvider>
        <GraphNodeEasyConnectContext.Provider value>
          <GraphNode {...nodeProps} isConnectable />
        </GraphNodeEasyConnectContext.Provider>
      </ReactFlowProvider>,
    );

    const handle = container.querySelector('[data-handleid="easy-connect"]');
    expect(handle).not.toBeNull();
    expect(handle?.classList.contains("z-20!")).toBe(true);
    expect(handle?.classList.contains("pointer-events-auto!")).toBe(true);
  });
});
