"use client";

import type { Connection, EdgeChange, NodeChange } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  GraphCanvasEditing,
  GraphCanvasProps,
} from "../components/GraphCanvas";
import type { LabelLocaleBindings } from "../components/LabelLocaleMenu";
import type { SidePanelProps } from "../components/sidePanel/SidePanel";
import {
  DEFAULT_NODE_TYPE,
  type NodeTypeFlag,
  resolveConnectionDirection,
} from "../nodeTypes";
import { toGraphData } from "../serialize";
import type {
  EdgeDirection,
  GraphCanvasNode,
  GraphData,
  GraphEdgeType,
  NodeType,
} from "../type";
import { isExternalNode, isGroupNode, isPointNode } from "../type";
import type {
  BulkEditResult,
  BulkPropertyAction,
} from "../utils/bulkProperties";
import {
  createEdge,
  createGroup,
  createNode,
  isLastExternal,
  keepGroupContents,
  keepLastExternal,
} from "../utils/graphMutations";
import { newId } from "../utils/idGen";
import { countLabeledNodes } from "../utils/labels";
import {
  canDeleteSelectedElements,
  getGroupSelectionError,
} from "../utils/selectionActions";
import { useGraphElements } from "./useGraphElements";
import { useLabelLocale } from "./useLabelLocale";

/** ツールバーに渡す props（保存の実処理は呼び出し側が持つ） */
export type GraphToolbarBindings = LabelLocaleBindings & {
  onAddNode: (nodeType: NodeType) => void;
  onAddGroup: () => void;
  onAutoAlign: () => void;
};

/** サイドパネルに渡す props のうち、編集状態から決まるもの */
export type SidePanelBindings = Omit<SidePanelProps, "graph">;

export type GraphEditorApi = {
  /** 描画用のグラフ（ハンドル・通知を注入済み） */
  graph: GraphData;
  selection: { nodeIds: string[]; edgeIds: string[] };
  setSelection: (nodeIds: string[], edgeIds: string[]) => void;
  /** 構造編集を有効にしたキャンバスの props */
  canvas: GraphCanvasProps & { editing: GraphCanvasEditing };
  toolbar: GraphToolbarBindings;
  properties: SidePanelBindings;
  /** 送信・永続化用のグラフデータを取り出す */
  getGraphData: () => GraphData;
};

/** 新規ポイントの初期配置（キャンバス左上寄りにばらけさせる） */
function randomPosition() {
  return { x: 80 + Math.random() * 320, y: 80 + Math.random() * 240 };
}

/**
 * グラフエディタの編集状態をまとめ、UI 各部へ渡す形に整えるフック。
 * 要素と selected は useGraphElements が持ち、選択情報と各 UI への
 * バインディングをここで導出する。
 */
export function useGraphEditor(initial: GraphData): GraphEditorApi {
  const t = useTranslations("Graph.editor");

  const [labelLocale, setLabelLocale] = useLabelLocale();

  const {
    nodes,
    edges,
    source,
    changeNodes,
    changeEdges,
    setSelection,
    appendNode,
    appendEdge,
    removeNode,
    removeGroup,
    removeSelection,
    groupSelection,
    reparentByDrop,
    setGroupMinSize,
    autoAlign,
    removeEdge,
    updateSelectedProperty,
    updateNodeData,
    updateNodeLabel,
    updateEdgeData,
    reverseEdge,
  } = useGraphElements(initial, labelLocale);

  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);
  const selectedEdges = useMemo(() => edges.filter((e) => e.selected), [edges]);
  const selection = useMemo(
    () => ({
      nodeIds: selectedNodes.map((n) => n.id),
      edgeIds: selectedEdges.map((e) => e.id),
    }),
    [selectedNodes, selectedEdges],
  );
  const selectionKey = JSON.stringify([
    selection.nodeIds.toSorted(),
    selection.edgeIds.toSorted(),
  ]);
  const [bulkFeedback, setBulkFeedback] = useState<{
    selectionKey: string;
    result: BulkEditResult;
  } | null>(null);
  useEffect(() => {
    setBulkFeedback((current) =>
      current?.selectionKey === selectionKey ? current : null,
    );
  }, [selectionKey]);
  const runBulkEdit = useCallback(
    (action: BulkPropertyAction) => {
      setBulkFeedback({ selectionKey, result: updateSelectedProperty(action) });
    },
    [selectionKey, updateSelectedProperty],
  );
  const setSelectedNodeFlag = useCallback(
    (flag: NodeTypeFlag, enabled: boolean) =>
      runBulkEdit({ kind: "nodeFlag", flag, enabled }),
    [runBulkEdit],
  );
  const setSelectedEdgeDirection = useCallback(
    (direction: EdgeDirection) =>
      runBulkEdit({ kind: "edgeDirection", direction }),
    [runBulkEdit],
  );
  const reverseSelectedEdges = useCallback(
    () => runBulkEdit({ kind: "reverseEdges" }),
    [runBulkEdit],
  );

  const selectionCount = selectedNodes.length + selectedEdges.length;
  const selectNode = useCallback(
    (id: string) => setSelection([id], []),
    [setSelection],
  );
  const selectEdge = useCallback(
    (id: string) => setSelection([], [id]),
    [setSelection],
  );
  const clearSelection = useCallback(
    () => setSelection([], []),
    [setSelection],
  );
  const onNodesChange = useCallback(
    (changes: NodeChange<GraphCanvasNode>[]) => changeNodes(changes),
    [changeNodes],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange<GraphEdgeType>[]) => changeEdges(changes),
    [changeEdges],
  );

  const isValidConnection = useCallback(
    (connection: Connection | GraphEdgeType): boolean => {
      const src = connection.source;
      const tgt = connection.target;
      if (!src || !tgt) return false;
      if (src === tgt) return false; // 自己ループは不可
      // グループコンテナはルートの端点にならない
      const srcNode = source.nodes.find((n) => n.id === src);
      const tgtNode = source.nodes.find((n) => n.id === tgt);
      if (!srcNode || !tgtNode) return false;
      if (isGroupNode(srcNode) || isGroupNode(tgtNode)) return false;
      if (isExternalNode(srcNode) && isExternalNode(tgtNode)) return false;
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
      if (!isValidConnection(connection)) return;

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
    [source, appendEdge, selectEdge, isValidConnection],
  );

  const selectedPoint =
    selectionCount === 1 && selectedNodes[0] && !isGroupNode(selectedNodes[0])
      ? selectedNodes[0]
      : undefined;
  const edgeTargets = useMemo(
    () =>
      selectedPoint
        ? nodes
            .filter((n) =>
              isValidConnection({
                source: selectedPoint.id,
                target: n.id,
                sourceHandle: null,
                targetHandle: null,
              }),
            )
            .map((n) => ({ id: n.id, label: n.data.label ?? n.id }))
        : [],
    [selectedPoint, nodes, isValidConnection],
  );
  const addEdgeFromSelected = useCallback(
    (target: string) => {
      if (!selectedPoint) return;
      onConnect({
        source: selectedPoint.id,
        target,
        sourceHandle: null,
        targetHandle: null,
      });
    },
    [selectedPoint, onConnect],
  );

  const setEdgeDirection = useCallback(
    (id: string, direction: EdgeDirection) => {
      updateEdgeData(id, { direction });
    },
    [updateEdgeData],
  );

  const setNodeType = useCallback(
    (id: string, nodeType: NodeType) => {
      updateNodeData(id, { nodeType });
    },
    [updateNodeData],
  );

  /** 編集言語のラベル（ポイント・グループ共通）を更新する */
  const setNodeLabel = useCallback(
    (id: string, label: string) => {
      updateNodeLabel(id, labelLocale, label);
    },
    [updateNodeLabel, labelLocale],
  );

  const addNodeAtPosition = useCallback(
    (
      position: { x: number; y: number },
      nodeType: NodeType = DEFAULT_NODE_TYPE,
      parentId?: string,
    ) => {
      const external = nodeType === "EXTERNAL";
      // 初期ラベルは編集中の言語にだけ設定する
      const node = createNode({
        id: newId("n"),
        labels: external
          ? {}
          : {
              [labelLocale]: t("newNodeLabel", {
                index:
                  source.nodes.filter(
                    (n) => isPointNode(n) && !isExternalNode(n),
                  ).length + 1,
              }),
            },
        nodeType,
        position,
      });
      appendNode(node, parentId);
      selectNode(node.id);
    },
    [source.nodes, appendNode, selectNode, t, labelLocale],
  );

  const addNode = useCallback(
    (nodeType: NodeType = DEFAULT_NODE_TYPE) => {
      addNodeAtPosition(randomPosition(), nodeType);
    },
    [addNodeAtPosition],
  );

  const addGroupAtPosition = useCallback(
    (position: { x: number; y: number }, parentId?: string) => {
      // 初期ラベルは編集中の言語にだけ設定する
      const group = createGroup({
        id: newId("g"),
        labels: {
          [labelLocale]: t("newGroupLabel", {
            index: source.nodes.filter(isGroupNode).length + 1,
          }),
        },
        position,
      });
      appendNode(group, parentId);
      selectNode(group.id);
    },
    [source.nodes, appendNode, selectNode, t, labelLocale],
  );

  const addGroup = useCallback(() => {
    addGroupAtPosition(randomPosition());
  }, [addGroupAtPosition]);

  const deleteNode = useCallback(
    (id: string) => {
      if (isLastExternal(id, source.nodes)) return;
      const node = source.nodes.find((n) => n.id === id);
      if (node && isGroupNode(node)) {
        // グループは「解除」: コンテナだけを取り除き、中身は残す
        removeGroup(id);
      } else {
        // ノードに接続しているルートも一緒に削除される。
        removeNode(id);
      }
      clearSelection();
    },
    [source.nodes, removeNode, removeGroup, clearSelection],
  );

  const beforeDelete = useCallback(
    async (toDelete: { nodes: GraphCanvasNode[]; edges: GraphEdgeType[] }) =>
      keepLastExternal(keepGroupContents(toDelete), source.nodes),
    [source.nodes],
  );

  const deleteEdge = useCallback(
    (id: string) => {
      removeEdge(id);
      clearSelection();
    },
    [removeEdge, clearSelection],
  );

  const deleteSelection = useCallback(() => {
    if (selectionCount !== 1) return;
    if (selectedNodes[0]) deleteNode(selectedNodes[0].id);
    else if (selectedEdges[0]) deleteEdge(selectedEdges[0].id);
  }, [selectionCount, selectedNodes, selectedEdges, deleteNode, deleteEdge]);

  const groupSelectionError = getGroupSelectionError(source.nodes);
  const canDeleteSelection = canDeleteSelectedElements(source);
  const groupSelected = useCallback(() => {
    if (getGroupSelectionError(source.nodes) !== null) return;
    groupSelection(
      createGroup({
        id: newId("g"),
        labels: {
          [labelLocale]: t("newGroupLabel", {
            index: source.nodes.filter(isGroupNode).length + 1,
          }),
        },
        position: { x: 0, y: 0 },
      }),
    );
  }, [source.nodes, groupSelection, labelLocale, t]);

  const onNodeDragStop = useCallback(
    (ids: string[]) => {
      reparentByDrop(ids);
    },
    [reparentByDrop],
  );

  const onGroupResizeEnd = useCallback(
    (id: string, size: { width: number; height: number }) => {
      setGroupMinSize(id, size);
    },
    [setGroupMinSize],
  );

  const getGraphData = useCallback(
    () => toGraphData(source.nodes, source.edges),
    [source],
  );

  const labelCounts = useMemo(
    () => countLabeledNodes(source.nodes),
    [source.nodes],
  );

  return {
    graph: { nodes, edges },
    selection,
    setSelection,
    canvas: {
      nodes,
      edges,
      onNodesChange,
      onEdgesChange,
      onSelectNode: selectNode,
      onSelectEdge: selectEdge,
      onClearSelection: clearSelection,
      editing: {
        onConnect,
        isValidConnection,
        onSetEdgeDirection: setEdgeDirection,
        onReverseEdge: reverseEdge,
        onSetNodeType: setNodeType,
        labelLocale,
        onSetNodeLabel: setNodeLabel,
        onAddNodeAtPosition: addNodeAtPosition,
        onAddGroupAtPosition: addGroupAtPosition,
        onDeleteNode: deleteNode,
        onDeleteEdge: deleteEdge,
        onBeforeDelete: beforeDelete,
        onNodeDragStop,
        onGroupResizeEnd,
      },
    },
    toolbar: {
      onAddNode: addNode,
      onAddGroup: addGroup,
      onAutoAlign: autoAlign,
      labelLocale,
      onChangeLabelLocale: setLabelLocale,
      labelCounts,
      labelTargetCount: source.nodes.filter((n) => !isExternalNode(n)).length,
    },
    properties: {
      selectedNode: selectionCount === 1 ? selectedNodes[0] : undefined,
      selectedEdge: selectionCount === 1 ? selectedEdges[0] : undefined,
      selectionCounts: {
        nodes: selectedNodes.filter(isPointNode).length,
        groups: selectedNodes.filter(isGroupNode).length,
        edges: selectedEdges.length,
      },
      labelLocale,
      onUpdateNode: updateNodeData,
      onSetNodeLabel: setNodeLabel,
      onUpdateEdge: updateEdgeData,
      onReverseEdge: reverseEdge,
      edgeTargets,
      onAddEdge: addEdgeFromSelected,
      onSetSelectedNodeFlag: setSelectedNodeFlag,
      onSetSelectedEdgeDirection: setSelectedEdgeDirection,
      onReverseSelectedEdges: reverseSelectedEdges,
      bulkResult:
        bulkFeedback?.selectionKey === selectionKey
          ? bulkFeedback.result
          : null,
      onDelete: deleteSelection,
      onDeleteSelected: removeSelection,
      canDeleteSelected: canDeleteSelection,
      onGroupSelected: groupSelected,
      groupSelectionError,
      onSelectNode: selectNode,
      onSelectEdge: selectEdge,
    },
    getGraphData,
  };
}
