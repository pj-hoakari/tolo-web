"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";
import { DetectionLineCreationModeToggle } from "@/features/tenant/detection/components/DetectionLineActions";
import { useDetectionStores } from "@/features/tenant/detection/stores/detectionStore";
import { BroadcastIndicator } from "@/features/tenant/webrtc/components/BroadcastIndicator";
import { useFirebaseConfig } from "@/features/tenant/webrtc/components/FirebaseConfigProvider";
import { useVideoSender } from "@/features/tenant/webrtc/hooks/useVideoSender";
import { orpc } from "@/lib/orpc";
import { useCrowdDetectionLoop } from "../hooks/useCrowdDetectionLoop";
import { useDetectCrowd } from "../hooks/useDetectCrowd";
import { useObservationReporting } from "../hooks/useObservationReporting";
import { createEspCameraVideoSource } from "../utils/espVideoSource";
import {
  type CrowdVideoSourceFactory,
  createCameraVideoSource,
} from "../utils/videoSource";
import { CrowdDetectionControls } from "./CrowdDetectionControls";
import { CrowdDetectionView } from "./CrowdDetectionView";
import { DevVideoSourcePanel } from "./DevVideoSourcePanel";
import { ObservationLockButton } from "./ObservationSoftLock";

const DEV_VIDEO_SOURCE_ENABLED = process.env.NODE_ENV === "development";

export type CrowdDetectionProps = {
  tenantId: string;
  eventId: string;
  edgeDeviceId: string;
  /** 指定すると ESP カメラを既定の映像ソースにする */
  cameraEdgeId?: string;
};

export function CrowdDetection({
  tenantId,
  eventId,
  edgeDeviceId,
  cameraEdgeId,
}: CrowdDetectionProps) {
  const t = useTranslations("Observation.errors");
  const firebaseConfig = useFirebaseConfig();

  const espSourceFactory = useMemo<CrowdVideoSourceFactory | null>(() => {
    if (!cameraEdgeId) {
      return null;
    }
    return () =>
      createEspCameraVideoSource({
        tenantId,
        eventId,
        edgeDeviceId: cameraEdgeId,
        firebaseConfig,
        requestSession: () =>
          orpc.signaling.requestConnection({
            eventId,
            edgeId: cameraEdgeId,
          }),
        issueToken: () =>
          orpc.signaling.issueConsoleFirestoreToken({ eventId }),
      });
  }, [tenantId, eventId, cameraEdgeId, firebaseConfig]);

  const [sourceFactory, setSourceFactory] = useState<CrowdVideoSourceFactory>(
    () => espSourceFactory ?? createCameraVideoSource,
  );

  const { videoSource, status, error, start, stop, reportDetectionError } =
    useDetectCrowd(sourceFactory);

  const [broadcastStream, setBroadcastStream] = useState<MediaStream | null>(
    null,
  );
  const { settingsStore, resultStore, viewStateStore } = useDetectionStores();
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const lineCanvasRef = useRef<HTMLCanvasElement>(null);

  const { active, edgeId, sendDetectionFrame } = useVideoSender({
    tenantId,
    eventId,
    edgeDeviceId,
    stream: broadcastStream,
    settingsStore,
  });

  useCrowdDetectionLoop({
    videoRef,
    overlayCanvasRef,
    lineCanvasRef,
    status,
    settingsStore,
    viewStateStore,
    resultStore,
    onBroadcastStreamChange: setBroadcastStream,
    onDetectionFrame: sendDetectionFrame,
    onDetectionError: reportDetectionError,
  });

  const { unregistered } = useObservationReporting({
    eventId,
    edgeDeviceId,
    listening: edgeId !== null,
    status,
    settingsStore,
    resultStore,
  });

  const handleSourceChange = useCallback((factory: CrowdVideoSourceFactory) => {
    setSourceFactory(() => factory);
  }, []);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <ObservationLockButton />
      {unregistered && (
        <p role="alert" className="text-destructive">
          {t("unregistered")}
        </p>
      )}
      {status === "detecting" && (
        <div className="flex w-full max-w-3xl justify-end px-4 sm:px-0">
          <DetectionLineCreationModeToggle viewStateStore={viewStateStore} />
        </div>
      )}
      {DEV_VIDEO_SOURCE_ENABLED && (
        <DevVideoSourcePanel
          status={status}
          onSourceChange={handleSourceChange}
          espEdgeId={cameraEdgeId}
          onEspSelect={
            espSourceFactory
              ? () => setSourceFactory(() => espSourceFactory)
              : undefined
          }
        />
      )}
      <CrowdDetectionControls status={status} onStart={start} onStop={stop} />
      <CrowdDetectionView
        videoSource={videoSource}
        status={status}
        error={error}
        videoRef={videoRef}
        overlayCanvasRef={overlayCanvasRef}
        lineCanvasRef={lineCanvasRef}
        settingsStore={settingsStore}
        resultStore={resultStore}
        viewStateStore={viewStateStore}
      />
      <BroadcastIndicator active={active} edgeId={edgeId} />
    </div>
  );
}
