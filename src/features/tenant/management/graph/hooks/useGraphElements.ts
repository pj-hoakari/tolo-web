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
import { isGroupNode, isPointNode } from "../type";
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
  fitGroupsToChildren,
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
      const applied = applyNodeChanges(changes, prepared);

      // グループの拡縮は確定イベントでのみ行う:
      // - 削除（子が減った）
      // - ポイントの寸法確定（初回計測・ラベル変更による幅の変化）
      // ドラッグ中の position 変化では動かさない（座標系が揺れるため）。
      // グループ自身の寸法変化（NodeResizer のリサイズ中）でも動かさず、
      // リサイズ確定は setGroupMinSize が担う。
      const shouldFit = changes.some(
        (change) =>
          change.type === "remove" ||
          (change.type === "dimensions" &&
            (() => {
              const node = applied.find((n) => n.id === change.id);
              return node !== undefined && isPointNode(node);
            })()),
      );
      return shouldFit ? fitGroupsToChildren(applied) : applied;
    });
  }, []);

  const changeEdges = useCallback((changes: EdgeChange<GraphEdgeType>[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  /** 追加位置がグループの内側なら、そのグループへ自動で所属させる */
  const appendNode = useCallback((node: GraphCanvasNode) => {
    setNodes((nds) => {
      const appended = sortByNesting([...nds, node]);
      return fitGroupsToChildren(
        reparentNode(appended, node.id, resolveParentGroup(node.id, appended)),
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
    setNodes((nds) => fitGroupsToChildren(withoutNode(nds, id)));
    setEdges((eds) => withoutEdgesOf(eds, id));
  }, []);

  /** グループコンテナを取り除く（中身は残し、親へ付け替える） */
  const removeGroup = useCallback((id: string) => {
    setNodes((nds) => fitGroupsToChildren(dissolveGroups(nds, [id])));
  }, []);

  /** ドラッグ終了したノードを、その位置を含むグループへ所属させ直す */
  const reparentByDrop = useCallback((ids: string[]) => {
    setNodes((nds) => {
      let next = nds;
      for (const id of ids) {
        next = reparentNode(next, id, resolveParentGroup(id, next));
      }
      return fitGroupsToChildren(next);
    });
  }, []);

  /**
   * グループの手動リサイズを確定する。指定サイズを最小サイズ
   * （フィットの下限）として保存し、実サイズは子へのフィットで決め直す。
   */
  const setGroupMinSize = useCallback(
    (id: string, size: { width: number; height: number }) => {
      setNodes((nds) =>
        fitGroupsToChildren(
          nds.map((n) =>
            n.id === id && isGroupNode(n)
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    minWidth: Math.round(size.width),
                    minHeight: Math.round(size.height),
                  },
                }
              : n,
          ),
        ),
      );
    },
    [],
  );

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
    setGroupMinSize,
    removeEdge,
    updateNodeData,
    updateEdgeData,
    reverseEdge,
  };
}
