"use client";

import { BroadcastIndicator } from "@/features/tenant/webrtc/components/BroadcastIndicator";
import { useVideoSender } from "@/features/tenant/webrtc/hooks/useVideoSender";
import { useDetectCrowd } from "../hooks/useDetectCrowd";
import { CrowdDetectionControls } from "./CrowdDetectionControls";
import { CrowdDetectionView } from "./CrowdDetectionView";

export type CrowdDetectionProps = {
  tenantId: string;
  eventId: string;
};

export function CrowdDetection({ tenantId, eventId }: CrowdDetectionProps) {
  const { stream, status, error, start, stop, reportDetectionError } =
    useDetectCrowd();

  const { active, edgeId } = useVideoSender({
    tenantId,
    eventId,
    stream,
  });

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <CrowdDetectionControls status={status} onStart={start} onStop={stop} />
      <CrowdDetectionView
        stream={stream}
        status={status}
        error={error}
        onDetectionError={reportDetectionError}
      />
      <BroadcastIndicator active={active} edgeId={edgeId} />
    </div>
  );
}
