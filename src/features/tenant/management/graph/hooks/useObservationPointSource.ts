"use client";

import { useMemo } from "react";
import { useEdgeDevices } from "@/features/tenant/webrtc/hooks/useEdgeDevices";
import type { ObservationPointsSource } from "../components/observation";
import type { GraphData } from "../type";
import { collectObservationPointIds } from "../utils/observationPoints";

/**
 * プロパティパネルに渡す観測点の選択肢を組み立てるフック。
 * 「稼働中のエッジ端末の観測点」（サーバ由来）と「使用中の観測点」（グラフ由来）を束ねる。
 */
export function useObservationPointSource({
  eventId,
  graph,
}: {
  eventId: string;
  graph: GraphData;
}): ObservationPointsSource {
  const { edges, status, refresh } = useEdgeDevices({ eventId });
  const available = useMemo(
    () =>
      edges
        .filter((edge) => edge.online)
        .flatMap((edge) => edge.observationPoints),
    [edges],
  );

  // 使用中の観測点はグラフから導出する（別途状態として持たない）
  const usedIds = useMemo(
    () => collectObservationPointIds(graph.nodes, graph.edges),
    [graph],
  );

  return { available, status, usedIds, onRefresh: refresh };
}
