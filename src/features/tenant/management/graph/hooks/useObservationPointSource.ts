"use client";

import { useMemo } from "react";
import { useFlowElementStates } from "@/features/flowState/useFlowElementStates";
import { useEdgeDevices } from "@/features/tenant/webrtc/hooks/useEdgeDevices";
import type { ObservationPointsSource } from "../components/observation";
import type { GraphData } from "../type";
import {
  collectObservationPointIds,
  flowStatesByObservationPoint,
} from "../utils/observationPoints";

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

  const flow = useFlowElementStates(eventId);
  const flowStates = useMemo(
    () => flowStatesByObservationPoint(graph.nodes, graph.edges, flow.states),
    [graph, flow.states],
  );

  return {
    available,
    status,
    usedIds,
    flowStates,
    flowStatesFailed: flow.failed,
    onRefresh: () => {
      refresh();
      void flow.refresh();
    },
  };
}
