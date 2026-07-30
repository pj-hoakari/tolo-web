"use client";

import { useCallback, useRef, useState } from "react";
import { useDetectionStores } from "@/features/tenant/detection/stores/detectionStore";
import { BroadcastIndicator } from "@/features/tenant/webrtc/components/BroadcastIndicator";
import { useVideoSender } from "@/features/tenant/webrtc/hooks/useVideoSender";
import { useCrowdDetectionLoop } from "../hooks/useCrowdDetectionLoop";
import { useDetectCrowd } from "../hooks/useDetectCrowd";
import {
  type CrowdVideoSourceFactory,
  createCameraVideoSource,
} from "../utils/videoSource";
import { CrowdDetectionControls } from "./CrowdDetectionControls";
import { CrowdDetectionView } from "./CrowdDetectionView";
import { DevVideoSourcePanel } from "./DevVideoSourcePanel";
import { ObservationSoftLock } from "./ObservationSoftLock";

const DEV_VIDEO_SOURCE_ENABLED = process.env.NODE_ENV === "development";

export type CrowdDetectionProps = {
  tenantId: string;
  eventId: string;
};

export function CrowdDetection({ tenantId, eventId }: CrowdDetectionProps) {
  const [sourceFactory, setSourceFactory] = useState<CrowdVideoSourceFactory>(
    () => createCameraVideoSource,
  );

  const { videoSource, status, error, start, stop, reportDetectionError } =
    useDetectCrowd(sourceFactory);

  const [broadcastStream, setBroadcastStream] = useState<MediaStream | null>(
    null,
  );
  const { settingsStore, resultStore, viewStateStore } = useDetectionStores();
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const { active, edgeId, sendDetectionFrame } = useVideoSender({
    tenantId,
    eventId,
    stream: broadcastStream,
    settingsStore,
  });

  useCrowdDetectionLoop({
    videoRef,
    overlayCanvasRef,
    status,
    settingsStore,
    resultStore,
    onBroadcastStreamChange: setBroadcastStream,
    onDetectionFrame: sendDetectionFrame,
    onDetectionError: reportDetectionError,
  });

  const handleSourceChange = useCallback((factory: CrowdVideoSourceFactory) => {
    setSourceFactory(() => factory);
  }, []);

  return (
    <ObservationSoftLock tenantId={tenantId} eventId={eventId}>
      <div className="flex w-full flex-col items-center gap-4">
        {DEV_VIDEO_SOURCE_ENABLED && (
          <DevVideoSourcePanel
            status={status}
            onSourceChange={handleSourceChange}
          />
        )}
        <CrowdDetectionControls status={status} onStart={start} onStop={stop} />
        <CrowdDetectionView
          videoSource={videoSource}
          status={status}
          error={error}
          videoRef={videoRef}
          overlayCanvasRef={overlayCanvasRef}
          settingsStore={settingsStore}
          resultStore={resultStore}
          viewStateStore={viewStateStore}
        />
        <BroadcastIndicator active={active} edgeId={edgeId} />
      </div>
    </ObservationSoftLock>
  );
}
