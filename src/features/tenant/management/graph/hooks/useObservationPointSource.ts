"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useEdgeDevices } from "@/features/tenant/webrtc/hooks/useEdgeDevices";
import { orpc } from "@/lib/orpc";
import type { ObservationPointsSource } from "../components/observation";
import type { FlowElementState } from "../flowElementState";
import type { GraphData } from "../type";
import {
  collectObservationPointIds,
  flowStatesByObservationPoint,
} from "../utils/observationPoints";

const FLOW_STATES_INTERVAL_MS = 30_000;

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

function useFlowElementStates(eventId: string) {
  const [states, setStates] = useState<FlowElementState[]>([]);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await orpc.observation.getFlowElementStates({ eventId });
      setStates(res.flowElementStates);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [eventId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), FLOW_STATES_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { states, failed, refresh };
}
