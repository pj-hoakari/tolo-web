"use client";

import { DetectionLineCountList } from "@/features/tenant/detection/components/DetectionLineCountList";
import { DetectionSettingsPanel } from "@/features/tenant/detection/components/DetectionSettingsPanel";
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
    stores,
    settingsSynced,
    connectedEdgeId,
    connect,
    disconnect,
  } = useVideoReceiver();

  // 設定を受け取るまでは観測側の値が分からないため，操作させない
  const editable = settingsSynced && receiveStatus === "connected";

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
        <>
          <VideoReceiverView
            stream={stream}
            status={receiveStatus}
            error={receiveError}
            detectionFrameRef={detectionFrameRef}
            settingsStore={editable ? stores.settingsStore : undefined}
            viewStateStore={editable ? stores.viewStateStore : undefined}
          />
          {editable && (
            <>
              <DetectionLineCountList
                settingsStore={stores.settingsStore}
                resultStore={stores.resultStore}
                viewStateStore={stores.viewStateStore}
              />
              <DetectionSettingsPanel
                settingsStore={stores.settingsStore}
                viewStateStore={stores.viewStateStore}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
