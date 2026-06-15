"use client";

import { EdgeCameraBroadcast } from "../../webrtc/components/EdgeCameraBroadcast";
import { useDetectCrowd } from "../hooks/useDetectCrowd";
import { CrowdDetectionControls } from "./CrowdDetectionControls";
import { CrowdDetectionView } from "./CrowdDetectionView";

export type CrowdDetectionProps = {
  broadcastRoomId?: string;
};

export function CrowdDetection({ broadcastRoomId }: CrowdDetectionProps) {
  const { stream, status, error, start, stop } = useDetectCrowd();

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <CrowdDetectionControls status={status} onStart={start} onStop={stop} />
      <CrowdDetectionView stream={stream} status={status} error={error} />
      {broadcastRoomId && (
        <EdgeCameraBroadcast roomId={broadcastRoomId} stream={stream} />
      )}
    </div>
  );
}
