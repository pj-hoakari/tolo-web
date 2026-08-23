// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type NodeProps, ReactFlowProvider } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import type { GroupNodeType } from "../type";
import { GraphNodeLabelEditingContext } from "./canvasContexts";
import { GroupNode } from "./GroupNode";

const groupProps = {
  id: "g1",
  // label は表示言語で解決済みの描画用フィールド（deriveNodeLabels が注入する形）
  data: { labels: { ja: "1F" }, label: "1F" },
  selected: false,
  isConnectable: false,
} as unknown as NodeProps<GroupNodeType>;

afterEach(cleanup);

describe("GroupNode", () => {
  it("ボックスのラベルをクリックすると、グループを選択したうえで編集を開始する", () => {
    const onUpdate = vi.fn();
    const onSelect = vi.fn();

    const { container } = render(
      <IntlTestProvider>
        <ReactFlowProvider>
          <GraphNodeLabelEditingContext.Provider
            value={{ locale: "ja", onUpdate, onSelect }}
          >
            <GroupNode {...groupProps} />
          </GraphNodeLabelEditingContext.Provider>
        </ReactFlowProvider>
      </IntlTestProvider>,
    );

    const labelButton = screen.getByRole("button", {
      name: "「1F」のラベルを編集",
    });
    expect(labelButton.classList.contains("border")).toBe(true);
    expect(labelButton.classList.contains("bg-card")).toBe(true);
    // ラベルは点線の上辺に重ねる
    const wrapper = labelButton.closest(".-translate-y-1\\/2");
    expect(wrapper).not.toBeNull();
    expect(wrapper?.classList.contains("top-0")).toBe(true);
    expect(wrapper?.classList.contains("left-3")).toBe(true);

    fireEvent.click(labelButton);

    expect(onSelect).toHaveBeenCalledWith("g1");
    const input = screen.getByRole("textbox", {
      name: "グループのラベル（日本語）",
    });
    expect(document.activeElement).toBe(input);
    // ボックスがそのまま入力欄になる（ポップアップを重ねない）
    expect(screen.queryByRole("button", { name: "「1F」のラベルを編集" })).toBe(
      null,
    );
    expect(input.closest(".w-56")).toBeNull();
    const field = input.closest(".inline-grid");
    expect(field).not.toBeNull();
    expect(field?.classList.contains("border")).toBe(true);
    expect(field?.classList.contains("bg-card")).toBe(true);
    expect(field?.classList.contains("px-2")).toBe(true);
    expect(field?.classList.contains("py-0.5")).toBe(true);
    // 入力欄と同じセルに置いた不可視のミラーが幅を作る
    const mirror = container.querySelector<HTMLElement>(
      '[aria-hidden="true"].whitespace-pre',
    );
    expect(mirror?.parentElement).toBe(field);
    expect(mirror?.textContent).toBe("1F");
  });

  it("編集した値を Enter で確定できる", () => {
    const onUpdate = vi.fn();
    const onSelect = vi.fn();

    const { container } = render(
      <IntlTestProvider>
        <ReactFlowProvider>
          <GraphNodeLabelEditingContext.Provider
            value={{ locale: "ja", onUpdate, onSelect }}
          >
            <GroupNode {...groupProps} />
          </GraphNodeLabelEditingContext.Provider>
        </ReactFlowProvider>
      </IntlTestProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "「1F」のラベルを編集" }),
    );
    const input = screen.getByRole("textbox", {
      name: "グループのラベル（日本語）",
    });
    fireEvent.change(input, { target: { value: "2F ホール" } });
    // ミラーが入力に追従して幅を広げる
    expect(
      container.querySelector('[aria-hidden="true"].whitespace-pre')
        ?.textContent,
    ).toBe("2F ホール");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onUpdate).toHaveBeenCalledWith("g1", "2F ホール");
  });

  it("表示専用ではラベルをボタンにせず、同じボックス見た目で表示する", () => {
    render(
      <IntlTestProvider>
        <ReactFlowProvider>
          <GroupNode {...groupProps} />
        </ReactFlowProvider>
      </IntlTestProvider>,
    );

    expect(screen.queryByRole("button")).toBeNull();
    const label = screen.getByText("1F");
    expect(label.tagName).toBe("DIV");
    expect(label.classList.contains("border")).toBe(true);
    expect(label.classList.contains("bg-card")).toBe(true);
  });
});
