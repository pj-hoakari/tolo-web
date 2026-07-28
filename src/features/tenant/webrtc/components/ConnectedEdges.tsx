"use client";

import { useAliveEdges } from "../hooks/useAliveEdges";
import { useVideoReceiver } from "../hooks/useVideoReceiver";
import { AliveEdgeList } from "./AliveEdgeList";
import { VideoReceiverView } from "./VideoReceiverView";

export type ConnectedEdgesProps = {
  tenantId: string;
  eventId: string;
};

export function ConnectedEdges({ tenantId, eventId }: ConnectedEdgesProps) {
  const { edges, status, error, refresh } = useAliveEdges({
    tenantId,
    eventId,
  });
  const {
    status: receiveStatus,
    error: receiveError,
    stream,
    detectionFrameRef,
    connectedEdgeId,
    connect,
    disconnect,
  } = useVideoReceiver();

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <AliveEdgeList
        edges={edges}
        status={status}
        error={error}
        onRefresh={refresh}
        connectedEdgeId={connectedEdgeId}
        receiveStatus={receiveStatus}
        onConnect={connect}
        onDisconnect={disconnect}
      />
      {connectedEdgeId && (
        <VideoReceiverView
          stream={stream}
          status={receiveStatus}
          error={receiveError}
          detectionFrameRef={detectionFrameRef}
        />
      )}
    </div>
  );
}
