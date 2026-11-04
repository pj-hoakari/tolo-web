"use client";

import { useCallback, useEffect, useState } from "react";
import { orpc } from "@/lib/orpc";
import type { FlowElementState } from "./type";

const FLOW_STATES_INTERVAL_MS = 30_000;

export function useFlowElementStates(eventId: string) {
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
