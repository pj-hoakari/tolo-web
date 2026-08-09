// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import { GraphCanvasContextMenu } from "./GraphCanvasContextMenu";

/** メッセージを解決できるよう next-intl のプロバイダ配下で描画する */
const renderWithIntl = (ui: ReactElement) =>
  render(ui, { wrapper: IntlTestProvider });

describe("GraphCanvasContextMenu", () => {
  it("クリック位置にポイントを追加する", () => {
    const onAddNode = vi.fn();
    const onClose = vi.fn();

    renderWithIntl(
      <GraphCanvasContextMenu
        position={{ x: 100, y: 100 }}
        nodePosition={{ x: 420, y: 180 }}
        nodeType="GOAL_TRANSIT_MIXED"
        onAddGroup={vi.fn()}
        onAddNode={onAddNode}
        isEdgeCreationActive={false}
        onStartEdgeCreation={vi.fn()}
        onEndEdgeCreation={vi.fn()}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole("menu", { name: "キャンバスの操作" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "ポイントを追加" }));

    expect(onAddNode).toHaveBeenCalledWith(
      { x: 420, y: 180 },
      "GOAL_TRANSIT_MIXED",
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("ルート追加モードを開始できる", () => {
    const onStartEdgeCreation = vi.fn();
    const onClose = vi.fn();

    renderWithIntl(
      <GraphCanvasContextMenu
        position={{ x: 100, y: 100 }}
        nodePosition={{ x: 420, y: 180 }}
        nodeType="GOAL_TRANSIT_MIXED"
        onAddGroup={vi.fn()}
        onAddNode={vi.fn()}
        isEdgeCreationActive={false}
        onStartEdgeCreation={onStartEdgeCreation}
        onEndEdgeCreation={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "ルートを追加" }));

    expect(onStartEdgeCreation).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("ルート追加モードを終了できる", () => {
    const onEndEdgeCreation = vi.fn();
    const onClose = vi.fn();

    renderWithIntl(
      <GraphCanvasContextMenu
        position={{ x: 100, y: 100 }}
        nodePosition={{ x: 420, y: 180 }}
        nodeType="GOAL_TRANSIT_MIXED"
        onAddGroup={vi.fn()}
        onAddNode={vi.fn()}
        isEdgeCreationActive
        onStartEdgeCreation={vi.fn()}
        onEndEdgeCreation={onEndEdgeCreation}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "ルート追加を終了" }));

    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
    expect(onEndEdgeCreation).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
