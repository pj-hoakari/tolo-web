"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type CameraSourceSpec,
  openCameraSources,
} from "../utils/cameraSources";
import {
  DetectionModelLoadError,
  initializeCrowdDetector,
  resetCrowdTracking,
} from "../utils/detectCrowd";
import {
  CameraAccessError,
  type CrowdVideoSource,
  type VideoSourceDescriptor,
} from "../utils/videoSource";
import type { DetectCrowdStatus } from "./useDetectCrowd";

export type CrowdSourceState = {
  key: string;
  status: "opening" | "ready" | "error";
  error: string | null;
};

export type UseCrowdVideoSourcesResult = {
  videoSource: VideoSourceDescriptor | null;
  status: DetectCrowdStatus;
  error: string | null;
  sourceStates: CrowdSourceState[];
  selectedKey: string | null;
  selectSource: (key: string) => void;
  start: () => void;
  stop: () => void;
  reportDetectionError: (cause: unknown) => void;
};

/**
 * 複数の映像ソースを同時に開いたまま、選択した1つの映像だけを表示する。
 * 検出ループは選択中の映像に対して動かし、カメラごとの推論の直列化は
 * Phase 5b で扱う。
 */
export function useCrowdVideoSources(
  specs: CameraSourceSpec[],
  initialSelectedKey?: string | null,
): UseCrowdVideoSourcesResult {
  const t = useTranslations("Observation.errors");
  const specsRef = useRef(specs);
  specsRef.current = specs;

  const openedRef = useRef<CrowdVideoSource[]>([]);
  const descriptorsRef = useRef<Map<string, VideoSourceDescriptor>>(new Map());
  const operationIdRef = useRef(0);

  const [descriptors, setDescriptors] = useState<
    Map<string, VideoSourceDescriptor>
  >(() => new Map());
  const [sourceStates, setSourceStates] = useState<CrowdSourceState[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(
    initialSelectedKey ?? specs[0]?.cameraEdgeId ?? null,
  );
  const [status, setStatus] = useState<DetectCrowdStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const describeError = useCallback(
    (cause: unknown): string => {
      if (cause instanceof DetectionModelLoadError) {
        return t("modelLoad", { status: cause.status, path: cause.path });
      }
      if (cause instanceof CameraAccessError) {
        return t(`camera.${cause.reason}`);
      }
      return cause instanceof Error ? cause.message : t("videoSource");
    },
    [t],
  );

  useEffect(() => {
    setSelectedKey((previous) => {
      if (previous && specs.some((spec) => spec.cameraEdgeId === previous)) {
        return previous;
      }
      if (
        initialSelectedKey &&
        specs.some((spec) => spec.cameraEdgeId === initialSelectedKey)
      ) {
        return initialSelectedKey;
      }
      return specs[0]?.cameraEdgeId ?? null;
    });
  }, [specs, initialSelectedKey]);

  const closeSources = useCallback(() => {
    for (const source of openedRef.current) {
      source.close();
    }
    openedRef.current = [];
    descriptorsRef.current = new Map();
    setDescriptors(new Map());
  }, []);

  const start = useCallback(async () => {
    const operationId = ++operationIdRef.current;
    resetCrowdTracking();
    closeSources();
    setError(null);
    setStatus("loading");

    const currentSpecs = specsRef.current;
    setSourceStates(
      currentSpecs.map((spec) => ({
        key: spec.cameraEdgeId,
        status: "opening",
        error: null,
      })),
    );

    const opened = await openCameraSources(currentSpecs);
    if (operationIdRef.current !== operationId) {
      for (const entry of opened) {
        entry.source.close();
      }
      return;
    }

    openedRef.current = opened.map((entry) => entry.source);
    const nextDescriptors = new Map<string, VideoSourceDescriptor>();
    const nextStates: CrowdSourceState[] = opened.map((entry) => {
      if (entry.descriptor) {
        nextDescriptors.set(entry.cameraEdgeId, entry.descriptor);
        return { key: entry.cameraEdgeId, status: "ready", error: null };
      }
      return {
        key: entry.cameraEdgeId,
        status: "error",
        error: describeError(entry.error),
      };
    });
    descriptorsRef.current = nextDescriptors;
    setDescriptors(nextDescriptors);
    setSourceStates(nextStates);

    const readyKeys = [...nextDescriptors.keys()];
    if (readyKeys.length === 0) {
      setStatus("error");
      setError(nextStates[0]?.error ?? t("videoSource"));
      return;
    }

    setSelectedKey((previous) => {
      if (previous && readyKeys.includes(previous)) {
        return previous;
      }
      if (initialSelectedKey && readyKeys.includes(initialSelectedKey)) {
        return initialSelectedKey;
      }
      return readyKeys[0];
    });

    try {
      await initializeCrowdDetector();
    } catch (cause) {
      if (operationIdRef.current !== operationId) {
        return;
      }
      closeSources();
      openedRef.current = [];
      setStatus("error");
      setError(describeError(cause));
      return;
    }

    if (operationIdRef.current !== operationId) {
      return;
    }
    setStatus("detecting");
  }, [closeSources, describeError, initialSelectedKey, t]);

  const stop = useCallback(() => {
    operationIdRef.current += 1;
    resetCrowdTracking();
    closeSources();
    openedRef.current = [];
    setSourceStates([]);
    setStatus("idle");
    setError(null);
  }, [closeSources]);

  const reportDetectionError = useCallback(
    (cause: unknown) => {
      operationIdRef.current += 1;
      resetCrowdTracking();
      closeSources();
      openedRef.current = [];
      setSourceStates([]);
      setStatus("error");
      setError(cause instanceof Error ? cause.message : t("detection"));
    },
    [closeSources, t],
  );

  useEffect(() => {
    return () => {
      operationIdRef.current += 1;
      resetCrowdTracking();
      for (const source of openedRef.current) {
        source.close();
      }
      openedRef.current = [];
    };
  }, []);

  const videoSource = useMemo(() => {
    if (!selectedKey) {
      return null;
    }
    return descriptors.get(selectedKey) ?? null;
  }, [descriptors, selectedKey]);

  const selectSource = useCallback((key: string) => {
    setSelectedKey(key);
  }, []);

  return {
    videoSource,
    status,
    error,
    sourceStates,
    selectedKey,
    selectSource,
    start: () => {
      start().catch((cause) => {
        console.error("failed to open video sources", cause);
      });
    },
    stop,
    reportDetectionError,
  };
}
