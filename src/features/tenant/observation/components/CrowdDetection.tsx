"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { JollySelect, SelectItem } from "@/components/ui/select";
import { DetectionLineCreationModeToggle } from "@/features/tenant/detection/components/DetectionLineActions";
import {
  createCameraDetectionStoreMaps,
  createDetectionResultStore,
  useDetectionStores,
} from "@/features/tenant/detection/stores/detectionStore";
import { BroadcastIndicator } from "@/features/tenant/webrtc/components/BroadcastIndicator";
import { useFirebaseConfig } from "@/features/tenant/webrtc/components/FirebaseConfigProvider";
import { useVideoSender } from "@/features/tenant/webrtc/hooks/useVideoSender";
import { orpc } from "@/lib/orpc";
import { useCrowdVideoSources } from "../hooks/useCrowdVideoSources";
import { useMultiCameraDetectionLoop } from "../hooks/useMultiCameraDetectionLoop";
import { useObservationPageCameras } from "../hooks/useObservationPageCameras";
import {
  type ObservationReportingCamera,
  useObservationReporting,
} from "../hooks/useObservationReporting";
import {
  selectCameraSettingsStore,
  selectCameraViewStateStore,
} from "../utils/cameraDetectionSettings";
import type { CameraCyclePhase } from "../utils/cameraScheduler";
import type { CameraSourceSpec } from "../utils/cameraSources";
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
const LOCAL_SOURCE_KEY = "local-camera";

export type CrowdDetectionProps = {
  tenantId: string;
  eventId: string;
  edgeDeviceId: string;
  /** 指定すると、委任されたカメラの中からこのカメラを初期選択にする */
  requestedCameraId?: string;
};

type SourceMode = "auto" | "esp" | "dev";

export function CrowdDetection({
  tenantId,
  eventId,
  edgeDeviceId,
  requestedCameraId,
}: CrowdDetectionProps) {
  const t = useTranslations("Observation.errors");
  const tCamera = useTranslations("Observation.cameraSelector");
  const tCameraStatus = useTranslations("Observation.cameraStatus");
  const firebaseConfig = useFirebaseConfig();

  const {
    cameras,
    initialCameraId,
    status: camerasStatus,
  } = useObservationPageCameras({
    eventId,
    pageEdgeDeviceId: edgeDeviceId,
    requestedCameraId,
  });

  const [sourceMode, setSourceMode] = useState<SourceMode>("auto");
  const [devSourceFactory, setDevSourceFactory] =
    useState<CrowdVideoSourceFactory>(() => createCameraVideoSource);

  const effectiveMode: "esp" | "dev" =
    sourceMode === "dev"
      ? "dev"
      : sourceMode === "esp" && cameras.length > 0
        ? "esp"
        : cameras.length > 0
          ? "esp"
          : "dev";

  const sourceSpecs = useMemo<CameraSourceSpec[]>(() => {
    if (effectiveMode === "dev") {
      return [
        { cameraEdgeId: LOCAL_SOURCE_KEY, createSource: devSourceFactory },
      ];
    }
    return cameras.map((camera) => ({
      cameraEdgeId: camera.edgeDeviceId,
      createSource: () =>
        createEspCameraVideoSource({
          tenantId,
          eventId,
          edgeDeviceId: camera.edgeDeviceId,
          firebaseConfig,
          label: camera.name || camera.edgeDeviceId,
          requestConnection: () =>
            orpc.signaling.requestCameraConnection({
              eventId,
              pageEdgeDeviceId: edgeDeviceId,
              cameraEdgeId: camera.edgeDeviceId,
            }),
        }),
    }));
  }, [
    effectiveMode,
    cameras,
    devSourceFactory,
    tenantId,
    eventId,
    edgeDeviceId,
    firebaseConfig,
  ]);

  const { settingsStore, resultStore, viewStateStore } = useDetectionStores();
  const cameraKeys = useMemo(
    () => sourceSpecs.map((spec) => spec.cameraEdgeId),
    [sourceSpecs],
  );
  const espCameraKeys = useMemo(
    () => (effectiveMode === "esp" ? cameraKeys : []),
    [effectiveMode, cameraKeys],
  );
  const {
    settingsStores: cameraSettingsStores,
    viewStateStores: cameraViewStateStores,
  } = useMemo(
    () => createCameraDetectionStoreMaps(espCameraKeys),
    [espCameraKeys],
  );
  const cameraResultStores = useMemo(
    () =>
      new Map(
        cameraKeys.map((key) => [
          key,
          createDetectionResultStore(
            selectCameraSettingsStore(
              key,
              cameraSettingsStores,
              settingsStore,
            ).getState().countingLines,
          ),
        ]),
      ),
    [cameraKeys, cameraSettingsStores, settingsStore],
  );

  const {
    videoSource,
    videoSources,
    freshness,
    isFresh,
    status,
    error,
    sourceStates,
    selectedKey,
    selectSource,
    start,
    stop,
  } = useCrowdVideoSources(
    sourceSpecs,
    effectiveMode === "esp" ? initialCameraId : LOCAL_SOURCE_KEY,
  );

  const selectedSettingsStore = selectCameraSettingsStore(
    selectedKey,
    cameraSettingsStores,
    settingsStore,
  );
  const selectedViewStateStore = selectCameraViewStateStore(
    selectedKey,
    cameraViewStateStores,
    viewStateStore,
  );

  const [broadcastStream, setBroadcastStream] = useState<MediaStream | null>(
    null,
  );
  const [cameraPhases, setCameraPhases] = useState<
    Record<string, { phase: CameraCyclePhase; error: string | null }>
  >({});
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

  const handleCameraPhase = useCallback(
    (key: string, phase: CameraCyclePhase, cause?: unknown) => {
      const error =
        phase === "error"
          ? cause instanceof Error
            ? cause.message
            : t("detection")
          : null;
      setCameraPhases((previous) => {
        const current = previous[key];
        if (current?.phase === phase && current.error === error) {
          return previous;
        }
        return { ...previous, [key]: { phase, error } };
      });
    },
    [t],
  );

  useEffect(() => {
    if (status === "detecting") {
      return;
    }
    setCameraPhases((previous) =>
      Object.keys(previous).length === 0 ? previous : {},
    );
  }, [status]);

  useMultiCameraDetectionLoop({
    sources: videoSources,
    selectedKey,
    isFresh,
    overlayCanvasRef,
    lineCanvasRef,
    status,
    settingsStore,
    viewStateStore,
    resultStore,
    cameraSettingsStores,
    cameraViewStateStores,
    cameraResultStores,
    onCameraPhase: handleCameraPhase,
    onBroadcastStreamChange: setBroadcastStream,
    onDetectionFrame: sendDetectionFrame,
  });

  const reportingCameras = useMemo<
    ObservationReportingCamera[] | undefined
  >(() => {
    if (effectiveMode !== "esp") {
      return undefined;
    }
    return cameras.flatMap((camera) => {
      if (!camera.observationPointId) {
        return [];
      }
      const cameraResultStore = cameraResultStores.get(camera.edgeDeviceId);
      const cameraSettingsStore = cameraSettingsStores.get(camera.edgeDeviceId);
      if (!cameraResultStore || !cameraSettingsStore) {
        return [];
      }
      return [
        {
          key: camera.edgeDeviceId,
          observationPointId: camera.observationPointId,
          settingsStore: cameraSettingsStore,
          resultStore: cameraResultStore,
        },
      ];
    });
  }, [effectiveMode, cameras, cameraResultStores, cameraSettingsStores]);

  const { unregistered } = useObservationReporting({
    eventId,
    edgeDeviceId,
    listening: edgeId !== null,
    status,
    settingsStore,
    resultStore,
    cameras: reportingCameras,
    isFresh,
  });

  const handleSourceChange = useCallback((factory: CrowdVideoSourceFactory) => {
    setDevSourceFactory(() => factory);
    setSourceMode("dev");
  }, []);

  const cameraErrors =
    effectiveMode === "esp"
      ? sourceStates.filter((state) => state.status === "error")
      : [];

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
          <DetectionLineCreationModeToggle
            viewStateStore={selectedViewStateStore}
          />
        </div>
      )}
      {DEV_VIDEO_SOURCE_ENABLED && (
        <DevVideoSourcePanel
          status={status}
          onSourceChange={handleSourceChange}
          espEdgeId={cameras[0]?.edgeDeviceId}
          onEspSelect={
            cameras.length > 0 ? () => setSourceMode("esp") : undefined
          }
        />
      )}
      <CrowdDetectionControls
        status={status}
        onStart={start}
        onStop={stop}
        disabled={camerasStatus === "loading"}
      />
      {effectiveMode === "esp" && cameras.length > 1 && (
        <JollySelect
          label={tCamera("label")}
          selectedKey={selectedKey}
          onSelectionChange={(key) => {
            if (key !== null) {
              selectSource(String(key));
            }
          }}
          items={cameras}
          className="w-full max-w-xs"
        >
          {(camera) => (
            <SelectItem id={camera.edgeDeviceId}>
              {camera.name || camera.edgeDeviceId}
            </SelectItem>
          )}
        </JollySelect>
      )}
      {cameraErrors.map((state) => {
        const camera = cameras.find(
          (entry) => entry.edgeDeviceId === state.key,
        );
        return (
          <p key={state.key} role="alert" className="text-destructive">
            {t("cameraSource", {
              camera: camera?.name || state.key,
              error: state.error ?? "",
            })}
          </p>
        );
      })}
      {effectiveMode === "esp" &&
        cameras.length > 0 &&
        status === "detecting" && (
          <ul className="flex w-full max-w-3xl flex-wrap gap-x-4 gap-y-1 px-4 text-xs text-muted-foreground sm:px-0">
            {cameras.map((camera) => {
              const loop = cameraPhases[camera.edgeDeviceId];
              const name = camera.name || camera.edgeDeviceId;
              const stale =
                loop?.phase === "stale" ||
                freshness.get(camera.edgeDeviceId) === false;
              return (
                <li key={camera.edgeDeviceId}>
                  {loop?.error
                    ? tCameraStatus("errorDetail", {
                        camera: name,
                        error: loop.error,
                      })
                    : tCameraStatus("label", {
                        camera: name,
                        status: tCameraStatus(
                          stale ? "stale" : (loop?.phase ?? "waiting"),
                        ),
                      })}
                </li>
              );
            })}
          </ul>
        )}
      <CrowdDetectionView
        videoSource={videoSource}
        status={status}
        error={error}
        videoRef={videoRef}
        overlayCanvasRef={overlayCanvasRef}
        lineCanvasRef={lineCanvasRef}
        settingsStore={selectedSettingsStore}
        resultStore={resultStore}
        viewStateStore={selectedViewStateStore}
      />
      <BroadcastIndicator active={active} edgeId={edgeId} />
    </div>
  );
}
