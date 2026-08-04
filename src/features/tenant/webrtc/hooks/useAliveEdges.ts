"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { orpc } from "@/lib/orpc";
import type { AliveEdge } from "../type";
import { edgeIdPrefix } from "../utils/edgeId";

export type AliveEdgesStatus = "idle" | "loading" | "ready" | "error";

export interface UseAliveEdgesResult {
  edges: AliveEdge[];
  status: AliveEdgesStatus;
  error: string | null;
  refresh: () => void;
}

export function useAliveEdges(params: {
  tenantId: string;
  eventId: string;
  intervalMs?: number;
}): UseAliveEdgesResult {
  const { tenantId, eventId, intervalMs = 5_000 } = params;
  const [edges, setEdges] = useState<AliveEdge[]>([]);
  const [status, setStatus] = useState<AliveEdgesStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("Webrtc.aliveEdges");

  const refresh = useCallback(async () => {
    setStatus((prev) => (prev === "ready" ? prev : "loading"));
    try {
      const response = await orpc.edges.listAlive();
      const prefix = edgeIdPrefix(tenantId, eventId);
      const filtered: AliveEdge[] = response.edges
        .filter((edge) => edge.id.startsWith(prefix))
        .map((edge) => ({
          id: edge.id,
          lastSeenAt: edge.lastSeenAt ? new Date(edge.lastSeenAt) : null,
        }));
      setEdges(filtered);
      setError(null);
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : t("loadError"));
    }
  }, [tenantId, eventId, t]);

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
