"use client";

import { useAliveEdges } from "../hooks/useAliveEdges";
import { AliveEdgeList } from "./AliveEdgeList";

export type ConnectedEdgesProps = {
  tenantId: string;
  eventId: string;
};

export function ConnectedEdges({ tenantId, eventId }: ConnectedEdgesProps) {
  const { edges, status, error, refresh } = useAliveEdges({
    tenantId,
    eventId,
  });

  return (
    <AliveEdgeList
      edges={edges}
      status={status}
      error={error}
      onRefresh={refresh}
    />
  );
}
