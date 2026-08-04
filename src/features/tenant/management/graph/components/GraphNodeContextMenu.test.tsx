// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import type { GraphNodeType } from "../type";
import { GraphNodeContextMenu } from "./GraphNodeContextMenu";

const node: GraphNodeType = {
  id: "n1",
  type: "graph",
  position: { x: 0, y: 0 },
  data: { label: "ポイント 1", nodeType: "GOAL" },
};

/** メッセージを解決できるよう next-intl のプロバイダ配下で描画する */
const renderWithIntl = (ui: ReactElement) =>
  render(ui, { wrapper: IntlTestProvider });

describe("GraphNodeContextMenu", () => {
  it("ノードタイプを変更できる", () => {
    const onSetType = vi.fn();
    const onClose = vi.fn();

    renderWithIntl(
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
    fireEvent.click(screen.getByRole("menuitemradio", { name: "通過のみ" }));

    expect(onSetType).toHaveBeenCalledWith("n1", "TRANSIT_ONLY");
    expect(onClose).toHaveBeenCalled();
  });

  it("メニュー名に対象ポイント名を含み、現在のタイプをラジオ選択として伝える", () => {
    renderWithIntl(
      <GraphNodeContextMenu
        node={node}
        nodes={[node]}
        edges={[]}
        position={{ x: 100, y: 100 }}
        onSetType={vi.fn()}
        onStartEdgeCreation={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("menu", { name: "ポイント「ポイント 1」の操作" }),
    ).toBeTruthy();

    // タイプ変更グループはヘッダー付きのグループとして関連付く
    expect(screen.getByRole("group", { name: "タイプを変更" })).toBeTruthy();

    // 現在のタイプ（GOAL = 目的地）だけがチェック状態
    expect(
      screen
        .getByRole("menuitemradio", { name: "目的地" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen
        .getByRole("menuitemradio", { name: "通過のみ" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("destructive 色のメニューからノードを削除できる", () => {
    const onDelete = vi.fn();

    renderWithIntl(
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

    renderWithIntl(
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
