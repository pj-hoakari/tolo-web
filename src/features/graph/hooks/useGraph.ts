"use client";

import { useCallback, useEffect, useState } from "react";
import type { GraphData } from "@/features/tenant/management/graph/type";
import { fetchGraph, type GraphKey } from "../api";

export type GraphLoadStatus = "loading" | "ready" | "error";

export type UseGraphResult =
  | { status: "loading"; graph: null; error: null; refresh: () => void }
  | { status: "ready"; graph: GraphData; error: null; refresh: () => void }
  | { status: "error"; graph: null; error: unknown; refresh: () => void };

/**
 * 会場グラフを取得して状態として持つフック
 * 取得元（API / サンプル）は `fetchGraph` が抽象化する。
 * key が変わるたび、および refresh のたびに取り直し、古い応答は捨てる。
 */
export function useGraph({ tenantId, eventId }: GraphKey): UseGraphResult {
  const [state, setState] = useState<Omit<UseGraphResult, "refresh">>({
    status: "loading",
    graph: null,
    error: null,
  });

  // 取得要求
  // refresh は同じ key でも新しいオブジェクトを作って取り直しを起こす
  const [request, setRequest] = useState<GraphKey>({ tenantId, eventId });
  if (request.tenantId !== tenantId || request.eventId !== eventId) {
    setRequest({ tenantId, eventId });
  }
  const refresh = useCallback(
    () => setRequest({ tenantId, eventId }),
    [tenantId, eventId],
  );

  useEffect(() => {
    let active = true;
    setState({ status: "loading", graph: null, error: null });
    fetchGraph(request).then(
      (graph) => {
        if (active) setState({ status: "ready", graph, error: null });
      },
      (error: unknown) => {
        if (active) setState({ status: "error", graph: null, error });
      },
    );
    return () => {
      active = false;
    };
  }, [request]);

  return { ...state, refresh } as UseGraphResult;
}
