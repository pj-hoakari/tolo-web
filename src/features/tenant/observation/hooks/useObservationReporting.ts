import { ORPCError } from "@orpc/client";
import { useEffect, useRef, useState } from "react";
import type {
  DetectionResultStore,
  DetectionSettingsStore,
} from "@/features/tenant/detection/stores/detectionStore";
import { orpc } from "@/lib/orpc";
import {
  buildWindowMeasurements,
  mapLinesToObservationPoints,
  type WindowMeasurement,
} from "../utils/measurements";
import type { DetectCrowdStatus } from "./useDetectCrowd";

const REPORT_INTERVAL_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 10_000;
const MAX_UNSENT_WINDOWS = 120;

const isUnregistered = (cause: unknown) =>
  cause instanceof ORPCError && cause.code === "PRECONDITION_FAILED";

export function useObservationReporting({
  eventId,
  edgeDeviceId,
  listening,
  status,
  settingsStore,
  resultStore,
}: {
  eventId: string;
  edgeDeviceId: string;
  listening: boolean;
  status: DetectCrowdStatus;
  settingsStore: DetectionSettingsStore;
  resultStore: DetectionResultStore;
}): { unregistered: boolean } {
  const [unregistered, setUnregistered] = useState(false);
  const [pointIdByName, setPointIdByName] = useState<ReadonlyMap<
    string,
    string
  > | null>(null);
  const unsentRef = useRef<WindowMeasurement[][]>([]);

  useEffect(() => {
    unsentRef.current = [];
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
      const activeObservationPointIds =
        detecting && pointIdByName
          ? [
              ...new Set(
                mapLinesToObservationPoints(
                  settingsStore.getState().countingLines,
                  pointIdByName,
                ).values(),
              ),
            ]
          : [];
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
  ]);

  useEffect(() => {
    if (!pointIdByName || status !== "detecting" || unregistered) {
      return;
    }
    let windowStart = new Date();
    let previous = resultStore.getState();

    const tick = () => {
      const pointIdByLineId = mapLinesToObservationPoints(
        settingsStore.getState().countingLines,
        pointIdByName,
      );
      const windowEnd = new Date();
      const current = resultStore.getState();
      const measurements = buildWindowMeasurements({
        pointIdByLineId,
        previous,
        current,
        windowStart,
        windowEnd,
      });
      windowStart = windowEnd;
      previous = current;
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
  ]);

  return { unregistered };
}
