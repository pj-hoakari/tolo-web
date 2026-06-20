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
import type {
  GraphEdgeData,
  GraphEdgeType,
  GraphNodeData,
  GraphNodeType,
  NodeType,
} from "../type";
import { assignHandlesByPosition, deriveNodeHandles } from "../utils/handles";
import { newId } from "../utils/idGen";

export type GraphSelection =
  | { type: "node"; id: string }
  | { type: "edge"; id: string }
  | null;

export function useGraphEditor() {
  const [nodes, setNodes] = useState<GraphNodeType[]>([]);
  const [edges, setEdges] = useState<GraphEdgeType[]>([]);
  const [selection, setSelection] = useState<GraphSelection>(null);

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
        if (
          change.type === "remove" &&
          selection?.type === "node" &&
          selection.id === change.id
        ) {
          setSelection(null);
        }
      }
    },
    [selection],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<GraphEdgeType>[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
      for (const change of changes) {
        if (
          change.type === "remove" &&
          selection?.type === "edge" &&
          selection.id === change.id
        ) {
          setSelection(null);
        }
      }
    },
    [selection],
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
          label: `ノード ${nodes.length + 1}`,
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
      setNodes((nds) => nds.filter((n) => n.id !== selection.id));
      setEdges((eds) =>
        eds.filter(
          (e) => e.source !== selection.id && e.target !== selection.id,
        ),
      );
    } else {
      setEdges((eds) => eds.filter((e) => e.id !== selection.id));
    }
    setSelection(null);
  }, [selection]);

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

  const selectNode = useCallback((id: string) => {
    setSelection({ type: "node", id });
  }, []);

  const selectEdge = useCallback((id: string) => {
    setSelection({ type: "edge", id });
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

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
    selectNode,
    selectEdge,
    clearSelection,
  };
}
