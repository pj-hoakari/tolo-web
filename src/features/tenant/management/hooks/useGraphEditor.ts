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
import type { GraphEdgeType, GraphNodeType } from "../type";
import {
  compactHandlesAfterRemoval,
  deriveNodeHandles,
} from "../utils/handles";
import { newId } from "../utils/idGen";

export type GraphSelection =
  | { type: "node"; id: string }
  | { type: "edge"; id: string }
  | null;

export function useGraphEditor() {
  const [nodes, setNodes] = useState<GraphNodeType[]>([]);
  const [edges, setEdges] = useState<GraphEdgeType[]>([]);
  const [selection, setSelection] = useState<GraphSelection>(null);

  // 各ノードのハンドル配置（使用中＋空き1）をエッジ状況から導出
  const derivedNodes = useMemo(
    () => deriveNodeHandles(nodes, edges),
    [nodes, edges],
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
      const removedIds = new Set<string>();
      for (const change of changes) {
        if (change.type === "remove") removedIds.add(change.id);
      }
      setEdges((eds) => {
        const removedEdges =
          removedIds.size > 0 ? eds.filter((e) => removedIds.has(e.id)) : [];
        const applied = applyEdgeChanges(changes, eds);
        return removedEdges.length > 0
          ? compactHandlesAfterRemoval(removedEdges, applied)
          : applied;
      });
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

  // 同じハンドルを複数エッジで使い回さない
  // 自己ループを防ぐ
  const isValidConnection = useCallback(
    (connection: Connection | GraphEdgeType): boolean => {
      const src = connection.source;
      const tgt = connection.target;
      const srcH = connection.sourceHandle ?? null;
      const tgtH = connection.targetHandle ?? null;
      if (!src || !tgt || !srcH || !tgtH) return false;
      if (src === tgt && srcH === tgtH) return false;
      for (const e of edges) {
        if (
          (e.source === src && e.sourceHandle === srcH) ||
          (e.target === src && e.targetHandle === srcH) ||
          (e.source === tgt && e.sourceHandle === tgtH) ||
          (e.target === tgt && e.targetHandle === tgtH)
        ) {
          return false;
        }
      }
      return true;
    },
    [edges],
  );

  const onConnect = useCallback((connection: Connection) => {
    if (
      !connection.source ||
      !connection.target ||
      !connection.sourceHandle ||
      !connection.targetHandle
    ) {
      return;
    }
    const newEdge: GraphEdgeType = {
      id: newId("e"),
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: "graph",
      data: {},
    };
    setEdges((eds) => addEdge(newEdge, eds));
    setSelection({ type: "edge", id: newEdge.id });
  }, []);

  const addNode = useCallback(() => {
    const id = newId("n");
    const newNode: GraphNodeType = {
      id,
      type: "graph",
      position: {
        x: 80 + Math.random() * 320,
        y: 80 + Math.random() * 240,
      },
      data: { label: `ノード ${nodes.length + 1}` },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelection({ type: "node", id });
  }, [nodes.length]);

  const deleteSelection = useCallback(() => {
    if (!selection) return;
    if (selection.type === "node") {
      setNodes((nds) => nds.filter((n) => n.id !== selection.id));
      setEdges((eds) => {
        const removed = eds.filter(
          (e) => e.source === selection.id || e.target === selection.id,
        );
        const remaining = eds.filter(
          (e) => e.source !== selection.id && e.target !== selection.id,
        );
        return compactHandlesAfterRemoval(removed, remaining);
      });
    } else {
      setEdges((eds) => {
        const removed = eds.filter((e) => e.id === selection.id);
        const remaining = eds.filter((e) => e.id !== selection.id);
        return compactHandlesAfterRemoval(removed, remaining);
      });
    }
    setSelection(null);
  }, [selection]);

  const selectNode = useCallback((id: string) => {
    setSelection({ type: "node", id });
  }, []);

  const selectEdge = useCallback((id: string) => {
    setSelection({ type: "edge", id });
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  return {
    nodes: derivedNodes,
    edges,
    selection,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    hasSelection: selection !== null,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    addNode,
    deleteSelection,
    selectNode,
    selectEdge,
    clearSelection,
  };
}
