"use client";

import { useEdgePresence } from "../hooks/useEdgePresence";

export type EdgePresenceProps = {
  tenantId: string;
  eventId: string;
};

export function EdgePresence({ tenantId, eventId }: EdgePresenceProps) {
  const { edgeId } = useEdgePresence({ tenantId, eventId });

  return (
    <p className="break-all text-gray-500 text-xs">
      {edgeId ? `観測点登録中: ${edgeId}` : "観測点登録を準備中…"}
    </p>
  );
}
