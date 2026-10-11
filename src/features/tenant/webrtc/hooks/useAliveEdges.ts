"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { orpc } from "@/lib/orpc";
import type { AliveEdge } from "../type";

export type AliveEdgesStatus = "idle" | "loading" | "ready" | "error";

export interface UseAliveEdgesResult {
  edges: AliveEdge[];
  status: AliveEdgesStatus;
  error: string | null;
  refresh: () => void;
}

export function useAliveEdges(params: {
  eventId: string;
  intervalMs?: number;
}): UseAliveEdgesResult {
  const { eventId, intervalMs = 5_000 } = params;
  const [edges, setEdges] = useState<AliveEdge[]>([]);
  const [status, setStatus] = useState<AliveEdgesStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("Webrtc.aliveEdges");

  const refresh = useCallback(async () => {
    setStatus((prev) => (prev === "ready" ? prev : "loading"));
    try {
      const response = await orpc.observation.listEdgeDevices({ eventId });
      const filtered: AliveEdge[] = response.devices
        .filter((device) => device.online)
        .map((device) => ({
          edgeDeviceId: device.edgeDeviceId,
          name: device.name,
          lastHeartbeatAt: device.lastHeartbeatAt
            ? new Date(device.lastHeartbeatAt)
            : null,
          observationPoints: device.observationPoints,
        }));
      setEdges(filtered);
      setError(null);
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : t("loadError"));
    }
  }, [eventId, t]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [refresh, intervalMs]);

  return {
    edges,
    status,
    error,
    refresh: () => {
      refresh().catch((e) => console.error("failed to refresh edges", e));
    },
  };
}
