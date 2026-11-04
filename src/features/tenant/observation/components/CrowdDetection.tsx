"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tab, TabList, Tabs } from "@/components/ui/tabs";
import { DetectionLineCreationModeToggle } from "@/features/tenant/detection/components/DetectionLineActions";
import {
  createCameraDetectionStoreMaps,
  createDetectionResultStore,
  useDetectionStores,
} from "@/features/tenant/detection/stores/detectionStore";
import { BroadcastIndicator } from "@/features/tenant/webrtc/components/BroadcastIndicator";
import { useFirebaseConfig } from "@/features/tenant/webrtc/components/FirebaseConfigProvider";
import { useVideoSender } from "@/features/tenant/webrtc/hooks/useVideoSender";
import { clearCameraConnectionAutoStart } from "@/features/tenant/webrtc/utils/cameraConnection";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { useCrowdVideoSources } from "../hooks/useCrowdVideoSources";
import { useEspCameraAutoStart } from "../hooks/useEspCameraAutoStart";
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
import {
  CAMERA_STATUS_DOT_CLASS,
  resolveCameraStatusKey,
} from "../utils/cameraStatus";
import { createEspCameraVideoSource } from "../utils/espVideoSource";
import { createMockCameraVideoSource } from "../utils/mockVideoSource";
import {
  type CrowdVideoSourceFactory,
  createCameraVideoSource,
} from "../utils/videoSource";
import { CameraConnectionAuthorizationNotice } from "./CameraConnectionAuthorizationNotice";
import { CrowdDetectionControls } from "./CrowdDetectionControls";
import { CrowdDetectionView } from "./CrowdDetectionView";
import { DevVideoSourcePanel } from "./DevVideoSourcePanel";
import { ObservationLockButton } from "./ObservationSoftLock";

const DEV_VIDEO_SOURCE_ENABLED = process.env.NODE_ENV === "development";
const API_MOCKING_ENABLED = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";
const LOCAL_SOURCE_KEY = "local-camera";

export type CrowdDetectionProps = {
  canReport: boolean;
  tenantId: string;
  eventId: string;
  edgeDeviceId: string;
  /** 指定すると、委任されたカメラの中からこのカメラを初期選択にする */
  requestedCameraId?: string;
};

type SourceMode = "auto" | "esp" | "dev";

export function CrowdDetection({
  canReport,
  tenantId,
  eventId,
  edgeDeviceId,
  requestedCameraId,
}: CrowdDetectionProps) {
  const t = useTranslations("Observation.errors");
  const tControls = useTranslations("Observation.controls");
  const tCameraStatus = useTranslations("Observation.cameraStatus");
  const firebaseConfig = useFirebaseConfig();

  const {
    cameras,
    initialCameraId,
    status: camerasStatus,
    cameraConnectionError: cameraListConnectionError,
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
    return cameras.map((camera) => {
      const label = camera.name || camera.edgeDeviceId;
      return {
        cameraEdgeId: camera.edgeDeviceId,
        createSource: API_MOCKING_ENABLED
          ? () =>
              createMockCameraVideoSource({
                label,
                requestConnection: () =>
                  orpc.signaling.requestCameraConnection({
                    eventId,
                    pageEdgeDeviceId: edgeDeviceId,
                    cameraEdgeId: camera.edgeDeviceId,
                  }),
              })
          : () =>
              createEspCameraVideoSource({
                tenantId,
                eventId,
                edgeDeviceId: camera.edgeDeviceId,
                firebaseConfig,
                label,
                requestConnection: () =>
                  orpc.signaling.requestCameraConnection({
                    eventId,
                    pageEdgeDeviceId: edgeDeviceId,
                    cameraEdgeId: camera.edgeDeviceId,
                  }),
              }),
      };
    });
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
    cameraConnectionError: videoConnectionError,
    sourceStates,
    selectedKey,
    selectSource,
    start,
    stop,
  } = useCrowdVideoSources(
    sourceSpecs,
    effectiveMode === "esp" ? initialCameraId : LOCAL_SOURCE_KEY,
  );

  const connectionAuthorizationError =
    cameraListConnectionError?.code === "CONNECTION_AUTHORIZATION_REQUIRED"
      ? cameraListConnectionError
      : videoConnectionError?.code === "CONNECTION_AUTHORIZATION_REQUIRED"
        ? videoConnectionError
        : null;

  useEffect(() => {
    if (status === "detecting" && !connectionAuthorizationError) {
      clearCameraConnectionAutoStart({
        eventId,
        pageEdgeDeviceId: edgeDeviceId,
      });
    }
  }, [status, connectionAuthorizationError, eventId, edgeDeviceId]);

  useEspCameraAutoStart({
    enabled: effectiveMode === "esp",
    cameraIds: espCameraKeys,
    start,
  });

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
    stream: canReport && !API_MOCKING_ENABLED ? broadcastStream : null,
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
    enabled: canReport,
    eventId,
    edgeDeviceId,
    listening: API_MOCKING_ENABLED || edgeId !== null,
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
    effectiveMode === "esp" && !connectionAuthorizationError
      ? sourceStates.filter((state) => state.status === "error")
      : [];
  const cameraErrorKeys = new Set(cameraErrors.map((state) => state.key));

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <ObservationLockButton />
      {unregistered && (
        <p role="alert" className="text-destructive">
          {t("unregistered")}
        </p>
      )}
      <CameraConnectionAuthorizationNotice
        error={connectionAuthorizationError}
        eventId={eventId}
        pageEdgeDeviceId={edgeDeviceId}
      />
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
      {effectiveMode === "dev" ? (
        <CrowdDetectionControls
          status={status}
          onStart={start}
          onStop={stop}
          disabled={camerasStatus === "loading"}
        />
      ) : status === "error" ? (
        <Button type="button" variant="secondary" size="sm" onPress={start}>
          {tControls("retry")}
        </Button>
      ) : null}
      {effectiveMode === "esp" && cameras.length > 0 && (
        <Tabs
          selectedKey={selectedKey ?? undefined}
          onSelectionChange={(key) => selectSource(String(key))}
          className="w-full max-w-3xl px-4 sm:px-0"
        >
          <TabList className="w-full justify-start overflow-x-auto">
            {cameras.map((camera) => {
              const loop = cameraPhases[camera.edgeDeviceId];
              const name = camera.name || camera.edgeDeviceId;
              const statusKey = resolveCameraStatusKey({
                phase: loop?.phase,
                stale:
                  loop?.phase === "stale" ||
                  freshness.get(camera.edgeDeviceId) === false,
                hasError:
                  status === "error" ||
                  Boolean(loop?.error) ||
                  cameraErrorKeys.has(camera.edgeDeviceId),
              });
              const statusText = tCameraStatus(statusKey);
              return (
                <Tab
                  key={camera.edgeDeviceId}
                  id={camera.edgeDeviceId}
                  aria-label={tCameraStatus("label", {
                    camera: name,
                    status: statusText,
                  })}
                  className="shrink-0 items-center gap-2"
                >
                  <span>{name}</span>
                  <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        CAMERA_STATUS_DOT_CLASS[statusKey],
                      )}
                    />
                    {statusText}
                  </span>
                </Tab>
              );
            })}
          </TabList>
        </Tabs>
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
      <CrowdDetectionView
        videoSource={videoSource}
        status={status}
        error={connectionAuthorizationError ? null : error}
        videoRef={videoRef}
        overlayCanvasRef={overlayCanvasRef}
        lineCanvasRef={lineCanvasRef}
        settingsStore={selectedSettingsStore}
        resultStore={resultStore}
        viewStateStore={selectedViewStateStore}
        showDetectionStatus={effectiveMode !== "esp"}
      />
      <BroadcastIndicator active={active} edgeId={edgeId} />
    </div>
  );
}
