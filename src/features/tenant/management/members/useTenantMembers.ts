"use client";

import { useCallback, useEffect, useState } from "react";
import { orpc } from "@/lib/orpc";
import type { TenantInvitation, TenantMember } from "./type";

export type Remote<T> =
  | { status: "loading" }
  | { status: "ready"; value: T }
  | { status: "error" };

export function useTenantMembers(tenantId: string) {
  const [members, setMembers] = useState<Remote<TenantMember[]>>({
    status: "loading",
  });
  const [invitations, setInvitations] = useState<Remote<TenantInvitation[]>>({
    status: "loading",
  });
  const [request, setRequest] = useState({ tenantId });
  if (request.tenantId !== tenantId) setRequest({ tenantId });
  const refresh = useCallback(() => setRequest({ tenantId }), [tenantId]);

  useEffect(() => {
    let active = true;
    function settle<T>(
      promise: Promise<T>,
      set: (remote: Remote<T>) => void,
    ): void {
      promise.then(
        (value) => active && set({ status: "ready", value }),
        () => active && set({ status: "error" }),
      );
    }
    settle(
      orpc.tenant.listMembers(request).then((r) => r.members),
      setMembers,
    );
    settle(
      orpc.tenant.listInvitations(request).then((r) => r.invitations),
      setInvitations,
    );
    return () => {
      active = false;
    };
  }, [request]);

  return { members, invitations, refresh };
}
