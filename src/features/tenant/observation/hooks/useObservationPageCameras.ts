"use client";

import { useEffect, useState } from "react";
import { orpc } from "@/lib/orpc";
import {
  type ObservationCamera,
  selectObservationCameras,
} from "../utils/cameraSources";

export type ObservationPageCamerasStatus = "loading" | "ready" | "error";

export type UseObservationPageCamerasResult = {
  cameras: ObservationCamera[];
  initialCameraId: string | null;
  status: ObservationPageCamerasStatus;
  error: string | null;
};

/**
 * 観測ページ自身の edge 端末を ListEdgeDevices から引き、cameraLinks に
 * 含まれるカメラを返す。ページが見つからない・種別が違う場合は error。
 */
export function useObservationPageCameras({
  eventId,
  pageEdgeDeviceId,
  requestedCameraId,
}: {
  eventId: string;
  pageEdgeDeviceId: string;
  requestedCameraId?: string;
}): UseObservationPageCamerasResult {
  const [cameras, setCameras] = useState<ObservationCamera[]>([]);
  const [initialCameraId, setInitialCameraId] = useState<string | null>(null);
  const [status, setStatus] = useState<ObservationPageCamerasStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);

    orpc.observation
      .listEdgeDevices({ eventId })
      .then(({ devices }) => {
        if (cancelled) {
          return;
        }
        const selection = selectObservationCameras(
          devices,
          pageEdgeDeviceId,
          requestedCameraId,
        );
        if (!selection.page) {
          setCameras([]);
          setInitialCameraId(null);
          setError("observation page was not found in this event");
          setStatus("error");
          return;
        }
        setCameras(selection.cameras);
        setInitialCameraId(selection.initialCameraId);
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        if (cancelled) {
          return;
        }
        console.error("failed to load observation page cameras", cause);
        setCameras([]);
        setInitialCameraId(null);
        setError(
          cause instanceof Error ? cause.message : "failed to load cameras",
        );
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, pageEdgeDeviceId, requestedCameraId]);

  return { cameras, initialCameraId, status, error };
}
