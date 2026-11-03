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
  eventId,
  edgeDeviceId,
  listening,
  status,
  settingsStore,
  resultStore,
  cameras,
}: {
  eventId: string;
  edgeDeviceId: string;
  listening: boolean;
  status: DetectCrowdStatus;
  settingsStore: DetectionSettingsStore;
  resultStore: DetectionResultStore;
  cameras?: readonly ObservationReportingCamera[];
}): { unregistered: boolean } {
  const [unregistered, setUnregistered] = useState(false);
  const [pointIdByName, setPointIdByName] = useState<ReadonlyMap<
    string,
    string
  > | null>(null);
  const unsentRef = useRef<WindowMeasurement[][]>([]);
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
  }, [eventId, edgeDeviceId]);

  useEffect(() => {
    if (!listening || unregistered) {
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
    eventId,
    edgeDeviceId,
    listening,
    pointIdByName,
    status,
    settingsStore,
    unregistered,
    cameras,
  ]);

  useEffect(() => {
    if (status !== "detecting" || unregistered) {
      return;
    }
    if (cameras) {
      if (cameras.every((camera) => camera.observationPointId === "")) {
        return;
      }
    } else if (!pointIdByName) {
      return;
    }

    let windowStart = new Date();
    let previous = resultStore.getState();
    const previousByCamera = new Map<string, DetectionResult>();
    for (const camera of cameras ?? []) {
      previousByCamera.set(camera.key, camera.resultStore.getState());
    }

    const tick = () => {
      const windowEnd = new Date();
      let measurements: WindowMeasurement[];

      if (cameras) {
        measurements = [];
        for (const camera of cameras) {
          const current = camera.resultStore.getState();
          const before = previousByCamera.get(camera.key) ?? current;
          if (camera.observationPointId !== "") {
            const countingLines = camera.settingsStore.getState().countingLines;
            measurements.push(
              ...buildWindowMeasurements({
                pointIdByLineId: mapLinesToObservationPoint(
                  countingLines,
                  camera.observationPointId,
                ),
                previous: before,
                current,
                windowStart,
                windowEnd,
              }),
            );
          }
          previousByCamera.set(camera.key, current);
        }
      } else {
        const current = resultStore.getState();
        measurements = buildWindowMeasurements({
          pointIdByLineId: mapLinesToObservationPoints(
            settingsStore.getState().countingLines,
            pointIdByName as ReadonlyMap<string, string>,
          ),
          previous,
          current,
          windowStart,
          windowEnd,
        });
        previous = current;
      }

      windowStart = windowEnd;
      const unsent = unsentRef.current;
      const windows =
        measurements.length === 0 ? unsent : [...unsent, measurements];
      unsentRef.current = [];
      if (windows.length === 0) {
        return;
      }
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

    const timer = setInterval(tick, REPORT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [
    eventId,
    edgeDeviceId,
    pointIdByName,
    status,
    settingsStore,
    resultStore,
    unregistered,
    cameras,
  ]);

  return { unregistered };
}
