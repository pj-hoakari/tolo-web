"use client";

import { useCallback, useEffect, useState } from "react";
import { orpc } from "@/lib/orpc";
import type { TenantEvent } from "./type";

export type UseTenantEventsResult =
  | { status: "loading"; events: null; error: null; refresh: () => void }
  | { status: "ready"; events: TenantEvent[]; error: null; refresh: () => void }
  | { status: "error"; events: null; error: unknown; refresh: () => void };

export function useTenantEvents(tenantId: string): UseTenantEventsResult {
  const [state, setState] = useState<Omit<UseTenantEventsResult, "refresh">>({
    status: "loading",
    events: null,
    error: null,
  });

  const [request, setRequest] = useState({ tenantId });
  if (request.tenantId !== tenantId) {
    setRequest({ tenantId });
  }
  const refresh = useCallback(() => setRequest({ tenantId }), [tenantId]);

  useEffect(() => {
    let active = true;
    orpc.tenant.listEvents(request).then(
      ({ events }) => {
        if (active) setState({ status: "ready", events, error: null });
      },
      (error: unknown) => {
        if (active) setState({ status: "error", events: null, error });
      },
    );
    return () => {
      active = false;
    };
  }, [request]);

  return { ...state, refresh } as UseTenantEventsResult;
}
