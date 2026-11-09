import { ORPCError } from "@orpc/client";
import { useEffect, useRef, useState } from "react";
import type {
  DetectionResult,
  DetectionResultStore,
  DetectionSettingsStore,
} from "@/features/tenant/detection/stores/detectionStore";
import { orpc } from "@/lib/orpc";
import {
  buildWindowMeasurements,
  mapLinesToObservationPoint,
  mapLinesToObservationPoints,
  type WindowMeasurement,
} from "../utils/measurements";
import type { DetectCrowdStatus } from "./useDetectCrowd";

const REPORT_INTERVAL_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 10_000;
const MAX_UNSENT_WINDOWS = 120;

const isUnregistered = (cause: unknown) =>
  cause instanceof ORPCError && cause.code === "PRECONDITION_FAILED";

export type ObservationReportingCamera = {
  key: string;
  /** カメラの cameraLinks で紐づいた観測点。未紐づけなら空文字。 */
  observationPointId: string;
  settingsStore: DetectionSettingsStore;
  resultStore: DetectionResultStore;
};

/**
 * 計測報告と Heartbeat。
 *
 * `cameras` を渡すと、カメラごとの結果から cameraLinks の観測点へ
 * 計測値を作る。省略した場合は従来どおり、選択中の resultStore と
 * ライン名で対応づけた観測点を使う（ローカルカメラ・開発用）。
 */
export function useObservationReporting({
  enabled = true,
  eventId,
  edgeDeviceId,
  listening,
  status,
  settingsStore,
  resultStore,
  cameras,
  isFresh,
}: {
  eventId: string;
  edgeDeviceId: string;
  enabled?: boolean;
  listening: boolean;
  status: DetectCrowdStatus;
  settingsStore: DetectionSettingsStore;
  resultStore: DetectionResultStore;
  cameras?: readonly ObservationReportingCamera[];
  /** カメラの映像が新しく届いているか。false のカメラは報告しない。 */
  isFresh: (key: string) => boolean;
}): {
  unregistered: boolean;
  pointIdByName: ReadonlyMap<string, string> | null;
} {
  const [unregistered, setUnregistered] = useState(false);
  const [pointIdByName, setPointIdByName] = useState<ReadonlyMap<
    string,
    string
  > | null>(null);
  const unsentRef = useRef<WindowMeasurement[][]>([]);
  const isFreshRef = useRef(isFresh);
  isFreshRef.current = isFresh;
  const reportContextRef = useRef({ eventId, edgeDeviceId });

  useEffect(() => {
    const previous = reportContextRef.current;
    if (
      previous.eventId !== eventId ||
      previous.edgeDeviceId !== edgeDeviceId
    ) {
      unsentRef.current = [];
      reportContextRef.current = { eventId, edgeDeviceId };
    }
  }, [eventId, edgeDeviceId]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    orpc.observation
      .listObservationPoints({ eventId, edgeDeviceId })
      .then(({ observationPoints }) => {
        if (!cancelled) {
          setPointIdByName(
            new Map(
              observationPoints.map((p) => [p.name, p.observationPointId]),
            ),
          );
        }
      })
      .catch((cause: unknown) => {
        console.error("failed to load observation points", cause);
        if (!cancelled && isUnregistered(cause)) {
          setUnregistered(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, eventId, edgeDeviceId]);

  useEffect(() => {
    if (!enabled || !listening || unregistered) {
      return;
    }
    const detecting = status === "detecting";

    const heartbeat = () => {
      let activeObservationPointIds: string[] = [];
      if (detecting) {
        if (cameras) {
          activeObservationPointIds = [
            ...new Set(
              cameras
                .filter((camera) => isFresh(camera.key))
                .map((camera) => camera.observationPointId)
                .filter((pointId) => pointId !== ""),
            ),
          ];
        } else if (pointIdByName) {
          activeObservationPointIds = [
            ...new Set(
              mapLinesToObservationPoints(
                settingsStore.getState().countingLines,
                pointIdByName,
              ).values(),
            ),
          ];
        }
      }
      orpc.observation
        .heartbeat({ eventId, edgeDeviceId, activeObservationPointIds })
        .catch((cause: unknown) => {
          console.error("failed to send heartbeat", cause);
          if (isUnregistered(cause)) {
            setUnregistered(true);
          }
        });
    };

    heartbeat();
    const timer = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [
    enabled,
    eventId,
    edgeDeviceId,
    listening,
    pointIdByName,
    status,
    settingsStore,
    unregistered,
    cameras,
    isFresh,
  ]);

  const reportingPointIdByName = cameras ? null : pointIdByName;
  useEffect(() => {
    if (!enabled || status !== "detecting" || unregistered) {
      return;
    }
    if (cameras) {
      if (cameras.every((camera) => camera.observationPointId === "")) {
        return;
      }
    } else if (!reportingPointIdByName) {
      return;
    }

    let windowStart = new Date();
    let previous = resultStore.getState();
    type CameraWindow = {
      previous: DetectionResult;
      latest: DetectionResult;
      start: Date;
      lastResultAt: Date;
      fresh: boolean;
      lines: ReturnType<DetectionSettingsStore["getState"]>["countingLines"];
    };
    const cameraWindows = new Map<string, CameraWindow>();
    const subscriptions: (() => void)[] = [];
    const pending: WindowMeasurement[] = [];

    const finishCameraWindow = (
      camera: ObservationReportingCamera,
      end: Date,
    ) => {
      const window = cameraWindows.get(camera.key);
      if (!window?.fresh || !camera.observationPointId) return;
      pending.push(
        ...buildWindowMeasurements({
          pointIdByLineId: mapLinesToObservationPoint(
            window.lines,
            camera.observationPointId,
          ),
          previous: window.previous,
          current: window.latest,
          windowStart: window.start,
          windowEnd: end,
          detectedPeopleKey: "all",
        }),
      );
      window.previous = window.latest;
      window.start = end;
    };

    for (const camera of cameras ?? []) {
      const now = new Date();
      const current = camera.resultStore.getState();
      const window: CameraWindow = {
        previous: current,
        latest: current,
        start: now,
        lastResultAt: now,
        fresh: isFreshRef.current(camera.key),
        lines: camera.settingsStore.getState().countingLines,
      };
      cameraWindows.set(camera.key, window);
      subscriptions.push(
        camera.resultStore.subscribe((current, prior) => {
          if (isFreshRef.current(camera.key)) {
            if (!window.fresh) {
              window.previous = prior;
              window.start = new Date();
              window.fresh = true;
            }
            window.latest = current;
            window.lastResultAt = new Date();
          }
        }),
      );
      subscriptions.push(
        camera.settingsStore.subscribe((current) => {
          if (current.countingLines === window.lines) return;
          finishCameraWindow(camera, new Date());
          window.lines = current.countingLines;
        }),
      );
    }

    const observeFreshness = () => {
      for (const camera of cameras ?? []) {
        const window = cameraWindows.get(camera.key);
        if (!window) continue;
        const fresh = isFreshRef.current(camera.key);
        if (window.fresh && !fresh) {
          if (window.latest !== window.previous) {
            finishCameraWindow(camera, window.lastResultAt);
          }
          window.fresh = false;
        } else if (!window.fresh && fresh) {
          const current = camera.resultStore.getState();
          window.previous = current;
          window.latest = current;
          window.start = new Date();
          window.lastResultAt = window.start;
          window.fresh = true;
        }
      }
    };

    const tick = (closing = false) => {
      const windowEnd = new Date();
      observeFreshness();
      if (cameras) {
        for (const camera of cameras) {
          const window = cameraWindows.get(camera.key);
          if (!closing || window?.latest !== window?.previous) {
            finishCameraWindow(camera, windowEnd);
          }
        }
      } else {
        const current = resultStore.getState();
        pending.push(
          ...buildWindowMeasurements({
            pointIdByLineId: mapLinesToObservationPoints(
              settingsStore.getState().countingLines,
              reportingPointIdByName as ReadonlyMap<string, string>,
            ),
            previous,
            current,
            windowStart,
            windowEnd,
          }),
        );
        previous = current;
      }
      windowStart = windowEnd;
      const measurements = pending.splice(0);
      const unsent = unsentRef.current;
      const windows =
        measurements.length === 0 ? unsent : [...unsent, measurements];
      unsentRef.current = [];
      if (windows.length === 0) return;
      orpc.observation
        .reportMeasurements({
          eventId,
          edgeDeviceId,
          measurements: windows.flat(),
        })
        .catch((cause: unknown) => {
          console.error("failed to report measurements", cause);
          if (isUnregistered(cause)) {
            setUnregistered(true);
            return;
          }
          unsentRef.current = [...windows, ...unsentRef.current].slice(
            -MAX_UNSENT_WINDOWS,
          );
        });
    };

    const freshnessTimer = cameras
      ? setInterval(observeFreshness, 1_000)
      : null;
    const timer = setInterval(() => tick(), REPORT_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      if (freshnessTimer !== null) clearInterval(freshnessTimer);
      for (const unsubscribe of subscriptions) unsubscribe();
      if (cameras) tick(true);
    };
  }, [
    enabled,
    eventId,
    edgeDeviceId,
    reportingPointIdByName,
    status,
    settingsStore,
    resultStore,
    unregistered,
    cameras,
  ]);

  return { unregistered, pointIdByName };
}
