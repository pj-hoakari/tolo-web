import { useReactFlow, type XYPosition } from "@xyflow/react";
import { useCallback, useMemo, useState } from "react";
import type { GraphCanvasNode, GraphEdgeType } from "../type";

export type CanvasContextMenuState =
  | { kind: "edge"; elementId: string; x: number; y: number }
  | {
      kind: "node";
      elementId: string;
      x: number;
      y: number;
      nodePosition: XYPosition;
    }
  | { kind: "canvas"; x: number; y: number; nodePosition: XYPosition };

export type CanvasContextMenuApi = {
  menu: CanvasContextMenuState | null;
  /** ノードメニューの対象。ノードメニューが開いていないときは undefined */
  menuNode: GraphCanvasNode | undefined;
  /** エッジメニューの対象。エッジメニューが開いていないときは undefined */
  menuEdge: GraphEdgeType | undefined;
  /** ノードメニューの状態。開いていないときは undefined */
  nodeMenu: Extract<CanvasContextMenuState, { kind: "node" }> | undefined;
  /** 背景メニューの状態。開いていないときは undefined */
  canvasMenu: Extract<CanvasContextMenuState, { kind: "canvas" }> | undefined;
  openNodeMenu: (event: React.MouseEvent, node: GraphCanvasNode) => void;
  openEdgeMenu: (event: React.MouseEvent, edge: GraphEdgeType) => void;
  openPaneMenu: (event: MouseEvent | React.MouseEvent) => void;
  close: () => void;
};

/**
 * キャンバス上の3種類（ノード・エッジ・背景）のコンテキストメニュー状態を扱うフック。
 * メニューを開くときに対象の選択（または選択解除）も合わせて行う。
 * 呼び出し側で ReactFlowProvider の内側に置くこと。
 */
export function useCanvasContextMenu({
  nodes,
  edges,
  onSelectNode,
  onSelectEdge,
  onClearSelection,
}: {
  nodes: GraphCanvasNode[];
  edges: GraphEdgeType[];
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
  onClearSelection: () => void;
}): CanvasContextMenuApi {
  const { screenToFlowPosition } = useReactFlow<
    GraphCanvasNode,
    GraphEdgeType
  >();
  const [menu, setMenu] = useState<CanvasContextMenuState | null>(null);

  const close = useCallback(() => setMenu(null), []);

  /**
   * クリック位置を、メニュー表示用のスクリーン座標と
   * 要素追加用のフロー座標のペアに変換する。
   */
  const toMenuPlacement = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      const point = { x: event.clientX, y: event.clientY };
      return { ...point, nodePosition: screenToFlowPosition(point) };
    },
    [screenToFlowPosition],
  );

  const openNodeMenu = useCallback(
    (event: React.MouseEvent, node: GraphCanvasNode) => {
      event.preventDefault();
      event.stopPropagation();
      onSelectNode(node.id);
      // グループ上での右クリックからも要素を追加できるよう、
      // クリック位置のフロー座標も持たせておく。
      setMenu({ kind: "node", elementId: node.id, ...toMenuPlacement(event) });
    },
    [onSelectNode, toMenuPlacement],
  );

  const openEdgeMenu = useCallback(
    (event: React.MouseEvent, edge: GraphEdgeType) => {
      event.preventDefault();
      event.stopPropagation();
      onSelectEdge(edge.id);
      setMenu({
        kind: "edge",
        elementId: edge.id,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [onSelectEdge],
  );

  const openPaneMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      onClearSelection();
      setMenu({ kind: "canvas", ...toMenuPlacement(event) });
    },
    [onClearSelection, toMenuPlacement],
  );

  return useMemo(
    () => ({
      menu,
      menuNode:
        menu?.kind === "node"
          ? nodes.find((node) => node.id === menu.elementId)
          : undefined,
      menuEdge:
        menu?.kind === "edge"
          ? edges.find((edge) => edge.id === menu.elementId)
          : undefined,
      nodeMenu: menu?.kind === "node" ? menu : undefined,
      canvasMenu: menu?.kind === "canvas" ? menu : undefined,
      openNodeMenu,
      openEdgeMenu,
      openPaneMenu,
      close,
    }),
    [menu, nodes, edges, openNodeMenu, openEdgeMenu, openPaneMenu, close],
  );
}
