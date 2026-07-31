"use client";

import type { Connection, EdgeChange, NodeChange } from "@xyflow/react";
import { useCallback } from "react";
import type {
  GraphCanvasEditing,
  GraphCanvasProps,
} from "../components/GraphCanvas";
import type { PropertiesPanelProps } from "../components/properties";
import { DEFAULT_NODE_TYPE, resolveConnectionDirection } from "../nodeTypes";
import { PLACEHOLDER_GRAPH } from "../placeholderGraph";
import { toGraphData } from "../serialize";
import type {
  GraphData,
  GraphEdgeType,
  GraphNodeType,
  NodeType,
} from "../type";
import { createEdge, createNode, removedIds } from "../utils/graphMutations";
import { newId } from "../utils/idGen";
import { useGraphElements } from "./useGraphElements";
import { useGraphSelection } from "./useGraphSelection";

/** ツールバーに渡す props（保存の実処理は呼び出し側が持つ） */
export type GraphToolbarBindings = {
  onAddNode: (nodeType: NodeType) => void;
};

/** プロパティパネルに渡す props のうち、編集状態から決まるもの */
export type PropertiesPanelBindings = Omit<PropertiesPanelProps, "graph">;

export type GraphEditorApi = {
  /** 描画用のグラフ（ハンドル・通知を注入済み） */
  graph: GraphData;
  /** 構造編集を有効にしたキャンバスの props */
  canvas: GraphCanvasProps & { editing: GraphCanvasEditing };
  toolbar: GraphToolbarBindings;
  properties: PropertiesPanelBindings;
  /** 送信・永続化用のグラフデータを取り出す */
  getGraphData: () => GraphData;
};

/** 新規ポイントの初期配置（キャンバス左上寄りにばらけさせる） */
function randomPosition() {
  return { x: 80 + Math.random() * 320, y: 80 + Math.random() * 240 };
}

/**
 * 会場エディタの編集状態をまとめ、UI 各部へ渡す形に整えるフック。
 * 状態は要素（useGraphElements）と選択（useGraphSelection）が持ち、
 * ここでは「ノードを消したら選択も解除する」といった連携だけを担う。
 */
export function useGraphEditor(initial?: GraphData): GraphEditorApi {
  const {
    nodes,
    edges,
    source,
    changeNodes,
    changeEdges,
    appendNode,
    appendEdge,
    removeNode,
    removeEdge,
    updateNodeData,
    updateEdgeData,
    reverseEdge,
  } = useGraphElements(initial ?? PLACEHOLDER_GRAPH);

  const { selection, selectNode, selectEdge, clearSelection, clearIfSelected } =
    useGraphSelection();

  const onNodesChange = useCallback(
    (changes: NodeChange<GraphNodeType>[]) => {
      changeNodes(changes);
      for (const id of removedIds(changes)) clearIfSelected("node", id);
    },
    [changeNodes, clearIfSelected],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<GraphEdgeType>[]) => {
      changeEdges(changes);
      for (const id of removedIds(changes)) clearIfSelected("edge", id);
    },
    [changeEdges, clearIfSelected],
  );

  const isValidConnection = useCallback(
    (connection: Connection | GraphEdgeType): boolean => {
      const src = connection.source;
      const tgt = connection.target;
      if (!src || !tgt) return false;
      if (src === tgt) return false; // 自己ループは不可
      // ノードタイプの制約
      // 既定 "both" が不可でも有効な方向があれば接続可とする
      return (
        resolveConnectionDirection(src, tgt, source.nodes, source.edges) !==
        null
      );
    },
    [source],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const direction =
        resolveConnectionDirection(
          connection.source,
          connection.target,
          source.nodes,
          source.edges,
        ) ?? "both";
      const edge = createEdge({
        id: newId("e"),
        source: connection.source,
        target: connection.target,
        direction,
      });
      appendEdge(edge);
      selectEdge(edge.id);
    },
    [source, appendEdge, selectEdge],
  );

  const addNode = useCallback(
    (nodeType: NodeType = DEFAULT_NODE_TYPE) => {
      const node = createNode({
        id: newId("n"),
        label: `ポイント ${source.nodes.length + 1}`,
        nodeType,
        position: randomPosition(),
      });
      appendNode(node);
      selectNode(node.id);
    },
    [source.nodes.length, appendNode, selectNode],
  );

  const deleteSelection = useCallback(() => {
    if (!selection) return;
    // ノードは接続しているルートも一緒に削除される
    if (selection.type === "node") removeNode(selection.id);
    else removeEdge(selection.id);
    clearSelection();
  }, [selection, removeNode, removeEdge, clearSelection]);

  const getGraphData = useCallback(
    () => toGraphData(source.nodes, source.edges),
    [source],
  );

  return {
    graph: { nodes, edges },
    canvas: {
      nodes,
      edges,
      onNodesChange,
      onEdgesChange,
      onSelectNode: selectNode,
      onSelectEdge: selectEdge,
      onClearSelection: clearSelection,
      editing: { onConnect, isValidConnection },
    },
    toolbar: { onAddNode: addNode },
    properties: {
      selectedNode:
        selection?.type === "node"
          ? nodes.find((n) => n.id === selection.id)
          : undefined,
      selectedEdge:
        selection?.type === "edge"
          ? edges.find((e) => e.id === selection.id)
          : undefined,
      onUpdateNode: updateNodeData,
      onUpdateEdge: updateEdgeData,
      onReverseEdge: reverseEdge,
      onDelete: deleteSelection,
    },
    getGraphData,
  };
}
