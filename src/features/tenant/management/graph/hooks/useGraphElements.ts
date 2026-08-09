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
  GraphCanvasNode,
  GraphData,
  GraphEdgeData,
  GraphEdgeType,
  GraphNodeData,
} from "../type";
import { isGroupNode } from "../type";
import {
  patchEdgeData,
  patchNodeData,
  reverseEdgeById,
  withoutEdge,
  withoutEdgesOf,
  withoutNode,
} from "../utils/graphMutations";
import {
  dissolveGroups,
  reparentNode,
  resolveParentGroup,
  sortByNesting,
} from "../utils/groups";
import { assignHandlesByPosition, deriveNodeHandles } from "../utils/handles";

/**
 * ノード/ルートの実体と、その描画用の派生情報を扱うフック。
 * 選択状態や観測点の使用状況には関与せず、要素の出し入れだけを担う。
 */
export function useGraphElements(initial: GraphData) {
  const [nodes, setNodes] = useState<GraphCanvasNode[]>(initial.nodes);
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

  const changeNodes = useCallback((changes: NodeChange<GraphCanvasNode>[]) => {
    setNodes((nds) => {
      // Delete キーなど React Flow 経由でグループが削除されるときも、
      // 中身は消さず親へ付け替えてからコンテナを取り除く
      const removedGroupIds = changes.flatMap((change) => {
        if (change.type !== "remove") return [];
        const node = nds.find((n) => n.id === change.id);
        return node && isGroupNode(node) ? [change.id] : [];
      });
      const prepared =
        removedGroupIds.length > 0 ? dissolveGroups(nds, removedGroupIds) : nds;
      return applyNodeChanges(changes, prepared);
    });
  }, []);

  const changeEdges = useCallback((changes: EdgeChange<GraphEdgeType>[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  /** 追加位置がグループの内側なら、そのグループへ自動で所属させる */
  const appendNode = useCallback((node: GraphCanvasNode) => {
    setNodes((nds) => {
      const appended = sortByNesting([...nds, node]);
      return reparentNode(
        appended,
        node.id,
        resolveParentGroup(node.id, appended),
      );
    });
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

  /** グループコンテナを取り除く（中身は残し、親へ付け替える） */
  const removeGroup = useCallback((id: string) => {
    setNodes((nds) => dissolveGroups(nds, [id]));
  }, []);

  /** ドラッグ終了したノードを、その位置を含むグループへ所属させ直す */
  const reparentByDrop = useCallback((ids: string[]) => {
    setNodes((nds) => {
      let next = nds;
      for (const id of ids) {
        next = reparentNode(next, id, resolveParentGroup(id, next));
      }
      return next;
    });
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
    removeGroup,
    reparentByDrop,
    removeEdge,
    updateNodeData,
    updateEdgeData,
    reverseEdge,
  };
}
