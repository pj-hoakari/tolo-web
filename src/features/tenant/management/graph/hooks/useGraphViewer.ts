"use client";

import { useCallback } from "react";
import type { GraphCanvasProps } from "../components/GraphCanvas";
import type { ObservationLinkPanelProps } from "../components/observation";
import { PLACEHOLDER_GRAPH } from "../placeholderGraph";
import { toGraphData } from "../serialize";
import type { GraphData } from "../type";
import { useGraphElements } from "./useGraphElements";
import { useGraphSelection } from "./useGraphSelection";

/** 紐づけパネルに渡す props のうち、表示状態から決まるもの */
export type ObservationLinkBindings = Omit<
  ObservationLinkPanelProps,
  "graph" | "observationPoints"
>;

export type GraphViewerApi = {
  /** 描画用のグラフ（ハンドル・通知を注入済み） */
  graph: GraphData;
  /** 表示専用（editing を持たない）キャンバスの props */
  canvas: GraphCanvasProps;
  links: ObservationLinkBindings;
  /** 送信・永続化用のグラフデータを取り出す */
  getGraphData: () => GraphData;
};

/**
 * 表示専用ビューの状態をまとめ、UI 各部へ渡す形に整えるフック。
 * グラフ構造（ポイント・ルートの増減、タイプ、方向、配置）は変更せず、
 * 付随情報である観測点の紐づけだけを書き換える。
 */
export function useGraphViewer(initial?: GraphData): GraphViewerApi {
  const {
    nodes,
    edges,
    source,
    changeNodes,
    changeEdges,
    updateNodeData,
    updateEdgeData,
  } = useGraphElements(initial ?? PLACEHOLDER_GRAPH);

  const { selection, selectNode, selectEdge, clearSelection } =
    useGraphSelection();

  const linkNode = useCallback(
    (id: string, observationPointIds: string[]) => {
      updateNodeData(id, { observationPointIds });
    },
    [updateNodeData],
  );

  const linkEdge = useCallback(
    (id: string, observationPointIds: string[]) => {
      updateEdgeData(id, { observationPointIds });
    },
    [updateEdgeData],
  );

  const getGraphData = useCallback(
    () => toGraphData(source.nodes, source.edges),
    [source],
  );

  return {
    graph: { nodes, edges },
    canvas: {
      nodes,
      edges,
      // 移動・接続はできないが、寸法計測と選択状態の反映には変更が必要
      onNodesChange: changeNodes,
      onEdgesChange: changeEdges,
      onSelectNode: selectNode,
      onSelectEdge: selectEdge,
      onClearSelection: clearSelection,
    },
    links: {
      selectedNode:
        selection?.type === "node"
          ? nodes.find((n) => n.id === selection.id)
          : undefined,
      selectedEdge:
        selection?.type === "edge"
          ? edges.find((e) => e.id === selection.id)
          : undefined,
      onLinkNode: linkNode,
      onLinkEdge: linkEdge,
    },
    getGraphData,
  };
}
