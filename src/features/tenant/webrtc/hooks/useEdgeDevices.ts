"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { orpc } from "@/lib/orpc";
import type { EdgeDeviceItem } from "../type";

export type EdgeDevicesStatus = "idle" | "loading" | "ready" | "error";

export interface UseEdgeDevicesResult {
  edges: EdgeDeviceItem[];
  status: EdgeDevicesStatus;
  error: string | null;
  refresh: () => void;
}

export function useEdgeDevices(params: {
  eventId: string;
  intervalMs?: number;
}): UseEdgeDevicesResult {
  const { eventId, intervalMs = 5_000 } = params;
  const [edges, setEdges] = useState<EdgeDeviceItem[]>([]);
  const [status, setStatus] = useState<EdgeDevicesStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("Webrtc.aliveEdges");

  const refresh = useCallback(async () => {
    setStatus((prev) => (prev === "ready" ? prev : "loading"));
    try {
      const response = await orpc.observation.listEdgeDevices({ eventId });
      const items: EdgeDeviceItem[] = response.devices
        .map((device) => ({
          edgeDeviceId: device.edgeDeviceId,
          name: device.name,
          online: device.online,
          lastHeartbeatAt: device.lastHeartbeatAt
            ? new Date(device.lastHeartbeatAt)
            : null,
          observationPoints: device.observationPoints,
        }))
        .toSorted((a, b) => Number(b.online) - Number(a.online));
      setEdges(items);
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
