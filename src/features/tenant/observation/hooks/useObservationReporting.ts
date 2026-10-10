import { useEffect, useState } from "react";
import type {
  DetectionResultStore,
  DetectionSettingsStore,
} from "@/features/tenant/detection/stores/detectionStore";
import { orpc } from "@/lib/orpc";
import {
  buildWindowMeasurements,
  mapLinesToObservationPoints,
} from "../utils/measurements";
import type { DetectCrowdStatus } from "./useDetectCrowd";

const REPORT_INTERVAL_MS = 30_000;

export function useObservationReporting({
  eventId,
  edgeDeviceId,
  status,
  settingsStore,
  resultStore,
}: {
  eventId: string;
  edgeDeviceId: string | undefined;
  status: DetectCrowdStatus;
  settingsStore: DetectionSettingsStore;
  resultStore: DetectionResultStore;
}): void {
  const [pointIdByName, setPointIdByName] = useState<ReadonlyMap<
    string,
    string
  > | null>(null);

  useEffect(() => {
    if (!edgeDeviceId) {
      return;
    }
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
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, edgeDeviceId]);

  useEffect(() => {
    if (!edgeDeviceId || !pointIdByName) {
      return;
    }
    const detecting = status === "detecting";
    let windowStart = new Date();
    let previous = resultStore.getState().lineCounts;

    const heartbeat = (activeObservationPointIds: string[]) => {
      orpc.observation
        .heartbeat({ eventId, edgeDeviceId, activeObservationPointIds })
        .catch((cause: unknown) => {
          console.error("failed to send heartbeat", cause);
        });
    };

    const tick = () => {
      const pointIdByLineId = mapLinesToObservationPoints(
        settingsStore.getState().countingLines,
        pointIdByName,
      );
      if (!detecting) {
        heartbeat([]);
        return;
      }
      heartbeat([...new Set(pointIdByLineId.values())]);

      const windowEnd = new Date();
      const current = resultStore.getState().lineCounts;
      const measurements = buildWindowMeasurements({
        pointIdByLineId,
        previous,
        current,
        windowStart,
        windowEnd,
      });
      windowStart = windowEnd;
      previous = current;
      if (measurements.length === 0) {
        return;
      }
      orpc.observation
        .reportMeasurements({ eventId, edgeDeviceId, measurements })
        .catch((cause: unknown) => {
          console.error("failed to report measurements", cause);
        });
    };

    heartbeat([]);
    const timer = setInterval(tick, REPORT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [
    eventId,
    edgeDeviceId,
    pointIdByName,
    status,
    settingsStore,
    resultStore,
  ]);
}
