"use client";

import {
  type FitViewOptions,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import { useEffect, useRef } from "react";
import type { GraphCanvasNode, GraphEdgeType } from "../type";

/** ノードの実寸法が確定してから、初回だけグラフ全体を表示する。 */
export function InitialFitView({
  hasNodes,
  options,
}: {
  hasNodes: boolean;
  options: FitViewOptions<GraphCanvasNode>;
}) {
  const nodesInitialized = useNodesInitialized();
  const { fitView, viewportInitialized } = useReactFlow<
    GraphCanvasNode,
    GraphEdgeType
  >();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (
      !hasNodes ||
      !nodesInitialized ||
      !viewportInitialized ||
      hasFitted.current
    )
      return;

    hasFitted.current = true;
    void fitView(options);
  }, [fitView, hasNodes, nodesInitialized, options, viewportInitialized]);

  return null;
}
