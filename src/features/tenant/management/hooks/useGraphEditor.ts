"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { useCallback, useMemo, useState } from "react";
import { DEFAULT_NODE_TYPE, resolveConnectionDirection } from "../nodeTypes";
import { PLACEHOLDER_GRAPH } from "../placeholderGraph";
import { toGraphData } from "../serialize";
import type {
  GraphData,
  GraphEdgeData,
  GraphEdgeType,
  GraphNodeData,
  GraphNodeType,
  NodeType,
} from "../type";
import { assignHandlesByPosition, deriveNodeHandles } from "../utils/handles";
import { newId } from "../utils/idGen";
import { collectObservationPointIds } from "../utils/observationPoints";

export type GraphSelection =
  | { type: "node"; id: string }
  | { type: "edge"; id: string }
  | null;

export function useGraphEditor(initial?: GraphData) {
  const [nodes, setNodes] = useState<GraphNodeType[]>(
    initial?.nodes ?? PLACEHOLDER_GRAPH.nodes,
  );
  const [edges, setEdges] = useState<GraphEdgeType[]>(
    initial?.edges ?? PLACEHOLDER_GRAPH.edges,
  );
  const [selection, setSelection] = useState<GraphSelection>(null);

  // 既にいずれかのノード/ルートに紐づけ済みの観測点 ID 集合
  const [usedObservationPointIds, setUsedObservationPointIds] = useState<
    Set<string>
  >(() =>
    collectObservationPointIds(
      initial?.nodes ?? PLACEHOLDER_GRAPH.nodes,
      initial?.edges ?? PLACEHOLDER_GRAPH.edges,
    ),
  );

  // 使用中集合から指定 ID を取り除く
  const dropUsedObservationPointIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setUsedObservationPointIds((used) => {
      const next = new Set(used);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  // ノード位置から各エッジの接続辺(上下左右)を決定
  // それに合わせて各ノードのハンドル配置（使用中＋空き1）を導出
  const derivedEdges = useMemo(
    () => assignHandlesByPosition(nodes, edges),
    [nodes, edges],
  );
  const derivedNodes = useMemo(
    () => deriveNodeHandles(nodes, derivedEdges),
    [nodes, derivedEdges],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<GraphNodeType>[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      for (const change of changes) {
        if (change.type !== "remove") continue;
        // 削除されたノードの紐づけ観測点を使用中集合から解放
        const removed = nodes.find((n) => n.id === change.id);
        dropUsedObservationPointIds(removed?.data.observationPointIds ?? []);
        if (selection?.type === "node" && selection.id === change.id) {
          setSelection(null);
        }
      }
    },
    [selection, nodes, dropUsedObservationPointIds],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<GraphEdgeType>[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
      for (const change of changes) {
        if (change.type !== "remove") continue;
        // 削除されたルートの紐づけ観測点を使用中集合から解放
        const removed = edges.find((e) => e.id === change.id);
        dropUsedObservationPointIds(removed?.data?.observationPointIds ?? []);
        if (selection?.type === "edge" && selection.id === change.id) {
          setSelection(null);
        }
      }
    },
    [selection, edges, dropUsedObservationPointIds],
  );

  const isValidConnection = useCallback(
    (connection: Connection | GraphEdgeType): boolean => {
      const src = connection.source;
      const tgt = connection.target;
      if (!src || !tgt) return false;
      if (src === tgt) return false; // 自己ループは不可
      // ノードタイプの制約
      // 既定 "both" が不可でも有効な方向があれば接続可とする
      if (resolveConnectionDirection(src, tgt, nodes, edges) === null) {
        return false;
      }
      return true;
    },
    [nodes, edges],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const direction =
        resolveConnectionDirection(
          connection.source,
          connection.target,
          nodes,
          edges,
        ) ?? "both";
      const newEdge: GraphEdgeType = {
        id: newId("e"),
        source: connection.source,
        target: connection.target,
        // 接続辺(sourceHandle/targetHandle)は位置から自動決定
        // 描画時に assignHandlesByPosition が付与。
        type: "graph",
        data: { direction },
      };
      setEdges((eds) => addEdge(newEdge, eds));
      setSelection({ type: "edge", id: newEdge.id });
    },
    [nodes, edges],
  );

  const addNode = useCallback(
    (nodeType: NodeType = DEFAULT_NODE_TYPE) => {
      const id = newId("n");
      const newNode: GraphNodeType = {
        id,
        type: "graph",
        position: {
          x: 80 + Math.random() * 320,
          y: 80 + Math.random() * 240,
        },
        data: {
          label: `ポイント ${nodes.length + 1}`,
          nodeType,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      setSelection({ type: "node", id });
    },
    [nodes.length],
  );

  const deleteSelection = useCallback(() => {
    if (!selection) return;
    if (selection.type === "node") {
      // ノード本体と、それに接続するルートの紐づけ観測点を使用中集合から解放
      const removedNode = nodes.find((n) => n.id === selection.id);
      const incidentEdges = edges.filter(
        (e) => e.source === selection.id || e.target === selection.id,
      );
      dropUsedObservationPointIds([
        ...(removedNode?.data.observationPointIds ?? []),
        ...incidentEdges.flatMap((e) => e.data?.observationPointIds ?? []),
      ]);
      setNodes((nds) => nds.filter((n) => n.id !== selection.id));
      setEdges((eds) =>
        eds.filter(
          (e) => e.source !== selection.id && e.target !== selection.id,
        ),
      );
    } else {
      const removedEdge = edges.find((e) => e.id === selection.id);
      dropUsedObservationPointIds(removedEdge?.data?.observationPointIds ?? []);
      setEdges((eds) => eds.filter((e) => e.id !== selection.id));
    }
    setSelection(null);
  }, [selection, nodes, edges, dropUsedObservationPointIds]);

  const updateNodeData = useCallback(
    (id: string, patch: Partial<GraphNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
      );
    },
    [],
  );

  const updateEdgeData = useCallback(
    (id: string, patch: Partial<GraphEdgeData>) => {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === id
            ? {
                ...e,
                data: { ...(e.data ?? { direction: "both" }), ...patch },
              }
            : e,
        ),
      );
    },
    [],
  );

  const reverseEdge = useCallback((id: string) => {
    setEdges((eds) =>
      eds.map((e) =>
        e.id === id ? { ...e, source: e.target, target: e.source } : e,
      ),
    );
  }, []);

  // 観測点のリンク操作。対象ノード/ルートの紐づけを `nextIds` に更新
  // 直前の紐づけとの差分だけ使用中集合へ反映
  const linkObservationPoints = useCallback(
    (target: { type: "node" | "edge"; id: string }, nextIds: string[]) => {
      const prev =
        target.type === "node"
          ? (nodes.find((n) => n.id === target.id)?.data.observationPointIds ??
            [])
          : (edges.find((e) => e.id === target.id)?.data?.observationPointIds ??
            []);

      if (target.type === "node") {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === target.id
              ? { ...n, data: { ...n.data, observationPointIds: nextIds } }
              : n,
          ),
        );
      } else {
        setEdges((eds) =>
          eds.map((e) =>
            e.id === target.id
              ? {
                  ...e,
                  data: {
                    ...(e.data ?? { direction: "both" }),
                    observationPointIds: nextIds,
                  },
                }
              : e,
          ),
        );
      }

      const added = nextIds.filter((id) => !prev.includes(id));
      const removed = prev.filter((id) => !nextIds.includes(id));
      if (added.length === 0 && removed.length === 0) return;
      setUsedObservationPointIds((used) => {
        const next = new Set(used);
        for (const id of added) next.add(id);
        for (const id of removed) next.delete(id);
        return next;
      });
    },
    [nodes, edges],
  );

  const selectNode = useCallback((id: string) => {
    setSelection({ type: "node", id });
  }, []);

  const selectEdge = useCallback((id: string) => {
    setSelection({ type: "edge", id });
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  // 編集済みのグラフデータ（描画用の派生情報を除いた送信/永続化用）を取得
  const getGraphData = useCallback(
    () => toGraphData(nodes, edges),
    [nodes, edges],
  );

  const selectedNode =
    selection?.type === "node"
      ? derivedNodes.find((n) => n.id === selection.id)
      : undefined;
  const selectedEdge =
    selection?.type === "edge"
      ? derivedEdges.find((e) => e.id === selection.id)
      : undefined;

  return {
    nodes: derivedNodes,
    edges: derivedEdges,
    selection,
    selectedNode,
    selectedEdge,
    usedObservationPointIds,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    hasSelection: selection !== null,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    addNode,
    deleteSelection,
    updateNodeData,
    updateEdgeData,
    reverseEdge,
    linkObservationPoints,
    selectNode,
    selectEdge,
    clearSelection,
    getGraphData,
  };
}
