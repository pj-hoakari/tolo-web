"use client";

import { useMemo } from "react";
import { useAliveEdges } from "@/features/tenant/webrtc/hooks/useAliveEdges";
import type { ObservationPointsSource } from "../components/properties";
import type { GraphData } from "../type";
import { collectObservationPointIds } from "../utils/observationPoints";

/**
 * プロパティパネルに渡す観測点の選択肢を組み立てるフック。
 * 「接続中の観測点」（サーバ由来）と「使用中の観測点」（グラフ由来）を束ねる。
 */
export function useObservationPointSource({
  tenantId,
  eventId,
  graph,
}: {
  tenantId: string;
  eventId: string;
  graph: GraphData;
}): ObservationPointsSource {
  const { edges, status, refresh } = useAliveEdges({ tenantId, eventId });

  // 使用中の観測点はグラフから導出する（別途状態として持たない）
  const usedIds = useMemo(
    () => collectObservationPointIds(graph.nodes, graph.edges),
    [graph],
  );

  return { available: edges, status, usedIds, onRefresh: refresh };
}
