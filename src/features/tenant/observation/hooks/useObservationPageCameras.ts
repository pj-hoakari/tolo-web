"use client";

import { useEffect, useState } from "react";
import {
  type CameraConnectionError,
  cameraConnectionError,
} from "@/features/tenant/webrtc/utils/cameraConnection";
import { orpc } from "@/lib/orpc";
import type { ObservationCamera } from "../utils/cameraSources";

export type ObservationPageCamerasStatus = "loading" | "ready" | "error";

export type UseObservationPageCamerasResult = {
  cameras: ObservationCamera[];
  initialCameraId: string | null;
  status: ObservationPageCamerasStatus;
  error: string | null;
  cameraConnectionError: CameraConnectionError | null;
};

/**
 * 観測ページ自身に委任されたカメラだけを BFF の listDelegatedCameras から
 * 引き、このページが接続してよいカメラを返す。
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
  const [connectionError, setConnectionError] =
    useState<CameraConnectionError | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);
    setConnectionError(null);

    orpc.camera
      .listDelegatedCameras({ eventId, pageEdgeDeviceId })
      .then(({ cameras: delegated }) => {
        if (cancelled) {
          return;
        }
        const unauthorized = delegated.find(
          (camera) => !camera.connectionAuthorized,
        );
        setConnectionError(
          unauthorized
            ? {
                code: "CONNECTION_AUTHORIZATION_REQUIRED",
                viewerType: null,
                eventId,
                pageEdgeDeviceId,
                cameraEdgeDeviceId: unauthorized.edgeDeviceId,
              }
            : null,
        );
        const next = delegated
          .filter((camera) => camera.connectionAuthorized)
          .map((camera) => ({
            edgeDeviceId: camera.edgeDeviceId,
            name: camera.name,
            observationPointId: camera.observationPointId,
          }));
        setCameras(next);
        setInitialCameraId(
          next.some((camera) => camera.edgeDeviceId === requestedCameraId)
            ? (requestedCameraId ?? null)
            : (next[0]?.edgeDeviceId ?? null),
        );
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
        setConnectionError(cameraConnectionError(cause));
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, pageEdgeDeviceId, requestedCameraId]);

  return {
    cameras,
    initialCameraId,
    status,
    error,
    cameraConnectionError: connectionError,
  };
}
