"use client";

import { useCallback, useMemo } from "react";
import type { GraphCanvasProps } from "../components/GraphCanvas";
import type { LabelLocaleBindings } from "../components/LabelLocaleMenu";
import type { ObservationLinkPanelProps } from "../components/observation";
import { PLACEHOLDER_GRAPH } from "../placeholderGraph";
import { toGraphData } from "../serialize";
import type { GraphData } from "../type";
import { isPointNode } from "../type";
import { countLabeledNodes } from "../utils/labels";
import { useGraphElements } from "./useGraphElements";
import { useGraphSelection } from "./useGraphSelection";
import { useLabelLocale } from "./useLabelLocale";

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
  /** ツールバーのラベル言語メニューに渡す props */
  toolbar: LabelLocaleBindings;
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
  // ポイントラベルの表示言語。既定は UI の表示言語で、独立して切り替えられる
  const [labelLocale, setLabelLocale] = useLabelLocale();

  const {
    nodes,
    edges,
    source,
    changeNodes,
    changeEdges,
    updateNodeData,
    updateEdgeData,
  } = useGraphElements(initial ?? PLACEHOLDER_GRAPH, labelLocale);

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

  const labelCounts = useMemo(
    () => countLabeledNodes(source.nodes),
    [source.nodes],
  );

  return {
    graph: { nodes, edges },
    toolbar: {
      labelLocale,
      onChangeLabelLocale: setLabelLocale,
      labelCounts,
      labelTargetCount: source.nodes.length,
    },
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
      // 観測点を紐づけられるのはポイントのみ（グループは対象外）
      selectedNode:
        selection?.type === "node"
          ? nodes.filter(isPointNode).find((n) => n.id === selection.id)
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
