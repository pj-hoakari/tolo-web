"use client";

import { useEffect, useState } from "react";
import { getOrCreateEdgeId } from "../utils/edgeId";
import { HEARTBEAT_INTERVAL_MS, writeEdgePresence } from "../utils/presence";

/**
 * このエッジを presence 登録するフック。エッジ側で保持する edgeId
 * （`${tenantId}_${eventId}_${uuid}`、再コネクト時も同一）で `edges/{edgeId}` に
 * 定期ハートビートし、生存エッジとして公開する。
 * enabled が false の間は登録しない（配信していない等で公開を止めたいとき用）。
 */
export function useEdgePresence(params: {
  tenantId: string;
  eventId: string;
  enabled?: boolean;
}): { edgeId: string | null } {
  const { tenantId, eventId, enabled = true } = params;
  const [edgeId, setEdgeId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    // localStorage / crypto アクセスはクライアントのみ。マウント後に edgeId を確定する。
    const id = getOrCreateEdgeId(tenantId, eventId);
    setEdgeId(id);

    const heartbeat = () => {
      writeEdgePresence(id).catch((error: unknown) => {
        console.error("failed to update edge presence", error);
      });
    };

    heartbeat();
    const timer = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [tenantId, eventId, enabled]);

  return { edgeId };
}
