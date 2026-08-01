"use client";

import {
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { useCallback, useMemo, useState } from "react";
import { deriveNodeNotices } from "../nodeTypes";
import type {
  GraphData,
  GraphEdgeData,
  GraphEdgeType,
  GraphNodeData,
  GraphNodeType,
} from "../type";
import {
  patchEdgeData,
  patchNodeData,
  reverseEdgeById,
  withoutEdge,
  withoutEdgesOf,
  withoutNode,
} from "../utils/graphMutations";
import { assignHandlesByPosition, deriveNodeHandles } from "../utils/handles";

/**
 * ノード/ルートの実体と、その描画用の派生情報を扱うフック。
 * 選択状態や観測点の使用状況には関与せず、要素の出し入れだけを担う。
 */
export function useGraphElements(initial: GraphData) {
  const [nodes, setNodes] = useState<GraphNodeType[]>(initial.nodes);
  const [edges, setEdges] = useState<GraphEdgeType[]>(initial.edges);

  // ノード位置から各エッジの接続辺(上下左右)を決定
  // それに合わせて各ノードの接続済みエッジ端点を導出
  const derivedEdges = useMemo(
    () => assignHandlesByPosition(nodes, edges),
    [nodes, edges],
  );
  const derivedNodes = useMemo(
    () =>
      deriveNodeNotices(deriveNodeHandles(nodes, derivedEdges), derivedEdges),
    [nodes, derivedEdges],
  );

  /** 派生情報を含まない、編集中のグラフそのもの */
  const source = useMemo<GraphData>(() => ({ nodes, edges }), [nodes, edges]);

  const changeNodes = useCallback((changes: NodeChange<GraphNodeType>[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const changeEdges = useCallback((changes: EdgeChange<GraphEdgeType>[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const appendNode = useCallback((node: GraphNodeType) => {
    setNodes((nds) => [...nds, node]);
  }, []);

  const appendEdge = useCallback((edge: GraphEdgeType) => {
    // addEdge経由で追加すると，connectionExistsによって重複が拒否される
    // 仕様として同一ポイント間の複数ルートを想定するため，直接追加
    setEdges((eds) => [...eds, edge]);
  }, []);

  /** ノードと、そのノードに接続しているルートをまとめて削除 */
  const removeNode = useCallback((id: string) => {
    setNodes((nds) => withoutNode(nds, id));
    setEdges((eds) => withoutEdgesOf(eds, id));
  }, []);

  const removeEdge = useCallback((id: string) => {
    setEdges((eds) => withoutEdge(eds, id));
  }, []);

  const updateNodeData = useCallback(
    (id: string, patch: Partial<GraphNodeData>) => {
      setNodes((nds) => patchNodeData(nds, id, patch));
    },
    [],
  );

  const updateEdgeData = useCallback(
    (id: string, patch: Partial<GraphEdgeData>) => {
      setEdges((eds) => patchEdgeData(eds, id, patch));
    },
    [],
  );

  const reverseEdge = useCallback((id: string) => {
    setEdges((eds) => reverseEdgeById(eds, id));
  }, []);

  return {
    /** 描画用（ハンドル・通知を注入済み） */
    nodes: derivedNodes,
    edges: derivedEdges,
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
  };
}
