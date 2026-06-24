"use client";

import { useRef, useState } from "react";
import { BroadcastIndicator } from "@/features/tenant/webrtc/components/BroadcastIndicator";
import { useVideoSender } from "@/features/tenant/webrtc/hooks/useVideoSender";
import {
  type DetectionSettings,
  INITIAL_SETTINGS,
  useCrowdDetectionLoop,
} from "../hooks/useCrowdDetectionLoop";
import { useDetectCrowd } from "../hooks/useDetectCrowd";
import {
  type CrowdVideoSourceFactory,
  createCameraVideoSource,
} from "../utils/videoSource";
import { CrowdDetectionControls } from "./CrowdDetectionControls";
import { CrowdDetectionView } from "./CrowdDetectionView";
import { DevVideoSourcePanel } from "./DevVideoSourcePanel";

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
  const [settings, setSettings] = useState<DetectionSettings>(INITIAL_SETTINGS);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const { lineCount, metrics } = useCrowdDetectionLoop({
    videoRef,
    overlayCanvasRef,
    status,
    settings,
    onBroadcastStreamChange: setBroadcastStream,
    onDetectionError: reportDetectionError,
  });

  const { active, edgeId } = useVideoSender({
    tenantId,
    eventId,
    stream: broadcastStream,
  });

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {DEV_VIDEO_SOURCE_ENABLED && (
        <DevVideoSourcePanel
          status={status}
          onSourceChange={(factory) => setSourceFactory(() => factory)}
        />
      )}
      <CrowdDetectionControls status={status} onStart={start} onStop={stop} />
      <CrowdDetectionView
        videoSource={videoSource}
        status={status}
        error={error}
        lineCount={lineCount}
        metrics={metrics}
        settings={settings}
        onSettingsChange={setSettings}
        videoRef={videoRef}
        overlayCanvasRef={overlayCanvasRef}
      />
      <BroadcastIndicator active={active} edgeId={edgeId} />
    </div>
  );
}
