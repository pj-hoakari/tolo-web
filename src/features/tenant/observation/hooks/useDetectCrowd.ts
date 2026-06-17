"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  initializeCrowdDetector,
  resetCrowdTracking,
} from "../utils/detectCrowd";
import {
  type CrowdVideoSource,
  type CrowdVideoSourceFactory,
  createCameraVideoSource,
  type VideoSourceDescriptor,
} from "../utils/videoSource";

export type DetectCrowdStatus = "idle" | "loading" | "detecting" | "error";

export function useDetectCrowd(
  createSource: CrowdVideoSourceFactory = createCameraVideoSource,
) {
  const sourceRef = useRef<CrowdVideoSource | null>(null);
  const operationIdRef = useRef(0);
  const [videoSource, setVideoSource] = useState<VideoSourceDescriptor | null>(
    null,
  );
  const [status, setStatus] = useState<DetectCrowdStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const releaseSource = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  const start = async () => {
    const operationId = ++operationIdRef.current;
    resetCrowdTracking();
    setError(null);
    setStatus("loading");

    const source = createSource();

    try {
      const descriptor = await source.open();

      if (operationIdRef.current !== operationId) {
        source.close();
        return;
      }

      sourceRef.current = source;

      setVideoSource(descriptor);

      await initializeCrowdDetector();

      if (
        operationIdRef.current !== operationId ||
        sourceRef.current !== source
      ) {
        return;
      }
      setStatus("detecting");
    } catch (e) {
      if (operationIdRef.current !== operationId) {
        source.close();
        return;
      }

      source.close();
      sourceRef.current = null;
      setVideoSource(null);
      setStatus("error");
      setError(
        e instanceof Error ? e.message : "映像ソースの取得に失敗しました",
      );
    }
  };

  const stop = () => {
    operationIdRef.current += 1;
    resetCrowdTracking();
    releaseSource();
    setVideoSource(null);
    setStatus("idle");
  };

  const reportDetectionError = useCallback(
    (cause: unknown) => {
      operationIdRef.current += 1;
      resetCrowdTracking();
      releaseSource();
      setVideoSource(null);
      setStatus("error");
      setError(
        cause instanceof Error ? cause.message : "人検出処理に失敗しました",
      );
    },
    [releaseSource],
  );

  useEffect(() => {
    return () => {
      operationIdRef.current += 1;
      resetCrowdTracking();
      releaseSource();
    };
  }, [releaseSource]);

  return { videoSource, status, error, start, stop, reportDetectionError };
}
