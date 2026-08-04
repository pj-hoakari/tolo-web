"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DetectionModelLoadError,
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
  const t = useTranslations("Observation.errors");

  /** 起動時の失敗を、モデル読み込み失敗だけ専用の文言にして伝える */
  const describeStartError = useCallback(
    (cause: unknown): string => {
      if (cause instanceof DetectionModelLoadError) {
        return t("modelLoad", { status: cause.status, path: cause.path });
      }
      return cause instanceof Error ? cause.message : t("videoSource");
    },
    [t],
  );

  const releaseSource = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  const start = useCallback(async () => {
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
      setError(describeStartError(e));
    }
  }, [createSource, describeStartError]);

  const stop = useCallback(() => {
    operationIdRef.current += 1;
    resetCrowdTracking();
    releaseSource();
    setVideoSource(null);
    setStatus("idle");
  }, [releaseSource]);

  const reportDetectionError = useCallback(
    (cause: unknown) => {
      operationIdRef.current += 1;
      resetCrowdTracking();
      releaseSource();
      setVideoSource(null);
      setStatus("error");
      setError(cause instanceof Error ? cause.message : t("detection"));
    },
    [releaseSource, t],
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
