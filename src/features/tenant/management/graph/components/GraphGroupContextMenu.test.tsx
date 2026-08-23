// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import type { GroupNodeType } from "../type";
import { GraphGroupContextMenu } from "./GraphGroupContextMenu";

const group: GroupNodeType = {
  id: "g1",
  type: "graphGroup",
  position: { x: 100, y: 100 },
  width: 400,
  height: 300,
  data: { labels: { ja: "1F" }, label: "1F" },
};

/** メッセージを解決できるよう next-intl のプロバイダ配下で描画する */
function renderMenu(
  props: Partial<React.ComponentProps<typeof GraphGroupContextMenu>> = {},
) {
  return render(
    <GraphGroupContextMenu
      group={group}
      position={{ x: 100, y: 100 }}
      nodePosition={{ x: 220, y: 180 }}
      nodeType="GOAL_TRANSIT_MIXED"
      onAddNode={vi.fn()}
      onAddGroup={vi.fn()}
      isEdgeCreationActive={false}
      onStartEdgeCreation={vi.fn()}
      onEndEdgeCreation={vi.fn()}
      onDissolve={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />,
    { wrapper: IntlTestProvider },
  );
}

describe("GraphGroupContextMenu", () => {
  it("クリック位置にグループ所属のポイントを追加する", () => {
    const onAddNode = vi.fn();
    const onClose = vi.fn();
    renderMenu({ onAddNode, onClose });

    expect(
      screen.getByRole("menu", { name: "グループ「1F」の操作" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "ポイントを追加" }));

    expect(onAddNode).toHaveBeenCalledWith(
      { x: 220, y: 180 },
      "GOAL_TRANSIT_MIXED",
      "g1",
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("クリック位置にネストしたグループを追加する", () => {
    const onAddGroup = vi.fn();
    renderMenu({ onAddGroup });

    fireEvent.click(screen.getByRole("menuitem", { name: "グループを追加" }));

    expect(onAddGroup).toHaveBeenCalledWith({ x: 220, y: 180 }, "g1");
  });

  it("ルート追加モードを開始できる", () => {
    const onStartEdgeCreation = vi.fn();
    renderMenu({ onStartEdgeCreation });

    fireEvent.click(screen.getByRole("menuitem", { name: "ルートを追加" }));

    expect(onStartEdgeCreation).toHaveBeenCalled();
  });

  it("ルート追加モード中は終了操作に切り替わる", () => {
    const onEndEdgeCreation = vi.fn();
    renderMenu({ isEdgeCreationActive: true, onEndEdgeCreation });

    expect(
      screen.queryByRole("menuitem", { name: "ポイントを追加" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "ルート追加を終了" }));

    expect(onEndEdgeCreation).toHaveBeenCalled();
  });

  it("グループを解除できる", () => {
    const onDissolve = vi.fn();
    renderMenu({ onDissolve });

    fireEvent.click(
      screen.getByRole("menuitem", { name: "グループを解除（中身は残す）" }),
    );

    expect(onDissolve).toHaveBeenCalledWith("g1");
  });
});
