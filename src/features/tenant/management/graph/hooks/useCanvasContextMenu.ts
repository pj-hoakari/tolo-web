import { useReactFlow, type XYPosition } from "@xyflow/react";
import { useCallback, useMemo, useState } from "react";
import type { GraphCanvasNode, GraphEdgeType } from "../type";

export type CanvasContextMenuState =
  | { kind: "edge"; elementId: string; x: number; y: number }
  | { kind: "node"; elementId: string; x: number; y: number }
  | { kind: "canvas"; x: number; y: number; nodePosition: XYPosition };

export type CanvasContextMenuApi = {
  menu: CanvasContextMenuState | null;
  /** ノードメニューの対象。ノードメニューが開いていないときは undefined */
  menuNode: GraphCanvasNode | undefined;
  /** エッジメニューの対象。エッジメニューが開いていないときは undefined */
  menuEdge: GraphEdgeType | undefined;
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

  const openNodeMenu = useCallback(
    (event: React.MouseEvent, node: GraphCanvasNode) => {
      event.preventDefault();
      event.stopPropagation();
      onSelectNode(node.id);
      setMenu({
        kind: "node",
        elementId: node.id,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [onSelectNode],
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
      setMenu({
        kind: "canvas",
        x: event.clientX,
        y: event.clientY,
        nodePosition: screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        }),
      });
    },
    [onClearSelection, screenToFlowPosition],
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
      canvasMenu: menu?.kind === "canvas" ? menu : undefined,
      openNodeMenu,
      openEdgeMenu,
      openPaneMenu,
      close,
    }),
    [menu, nodes, edges, openNodeMenu, openEdgeMenu, openPaneMenu, close],
  );
}
