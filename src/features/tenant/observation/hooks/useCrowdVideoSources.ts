"use client";

import { ORPCError } from "@orpc/client";
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
  isFrameFresh,
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
  /** 開いた全カメラの映像ソース。選択中以外も検出ループが利用する。 */
  videoSources: ReadonlyMap<string, VideoSourceDescriptor>;
  /** カメラごとに新しいフレームが届いているか。UI 表示用。 */
  freshness: ReadonlyMap<string, boolean>;
  /** カメラの映像が新しく届いているか。検出と報告の可否に使う。 */
  isFresh: (key: string) => boolean;
  status: DetectCrowdStatus;
  error: string | null;
  sourceStates: CrowdSourceState[];
  selectedKey: string | null;
  selectSource: (key: string) => void;
  start: () => void;
  stop: () => void;
  reportDetectionError: (cause: unknown) => void;
};

const FRESHNESS_POLL_INTERVAL_MS = 1_000;

function areFreshnessEqual(
  a: ReadonlyMap<string, boolean>,
  b: ReadonlyMap<string, boolean>,
): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const [key, fresh] of a) {
    if (b.get(key) !== fresh) {
      return false;
    }
  }
  return true;
}

/**
 * 複数の映像ソースを同時に開いたまま、選択した1つの映像だけを表示する。
 * すべての映像ソースを返し、検出ループがカメラごとに直列処理できるようにする。
 */
export function useCrowdVideoSources(
  specs: CameraSourceSpec[],
  initialSelectedKey?: string | null,
): UseCrowdVideoSourcesResult {
  const t = useTranslations("Observation.errors");
  const specsRef = useRef(specs);
  specsRef.current = specs;

  const openedRef = useRef<CrowdVideoSource[]>([]);
  const sourceByKeyRef = useRef<Map<string, CrowdVideoSource>>(new Map());
  const lastFrameAtRef = useRef<Map<string, number | null>>(new Map());
  const descriptorsRef = useRef<Map<string, VideoSourceDescriptor>>(new Map());
  const operationIdRef = useRef(0);

  const [descriptors, setDescriptors] = useState<
    Map<string, VideoSourceDescriptor>
  >(() => new Map());
  const [freshness, setFreshness] = useState<ReadonlyMap<string, boolean>>(
    () => new Map(),
  );
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
      if (cause instanceof ORPCError) {
        const code = (cause.data as { code?: unknown } | undefined)?.code;
        if (code === "CONNECTION_AUTHORIZATION_REQUIRED") {
          return t("connectionAuthorizationRequired");
        }
        if (code === "CAMERA_NOT_DELEGATED") {
          return t("cameraNotDelegated");
        }
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

  const readFreshness = useCallback((): Map<string, boolean> => {
    const now = performance.now();
    const next = new Map<string, boolean>();
    for (const [key, source] of sourceByKeyRef.current) {
      const lastFrameAt = source.lastFrameAt();
      lastFrameAtRef.current.set(key, lastFrameAt);
      next.set(key, isFrameFresh(lastFrameAt, now));
    }
    return next;
  }, []);

  const publishFreshness = useCallback(() => {
    const next = readFreshness();
    setFreshness((previous) =>
      areFreshnessEqual(previous, next) ? previous : next,
    );
  }, [readFreshness]);

  const isFresh = useCallback((key: string): boolean => {
    const source = sourceByKeyRef.current.get(key);
    if (!source) {
      return false;
    }
    const lastFrameAt = source.lastFrameAt();
    lastFrameAtRef.current.set(key, lastFrameAt);
    return isFrameFresh(lastFrameAt);
  }, []);

  const closeSources = useCallback(() => {
    for (const source of openedRef.current) {
      source.close();
    }
    openedRef.current = [];
    sourceByKeyRef.current = new Map();
    lastFrameAtRef.current = new Map();
    descriptorsRef.current = new Map();
    setDescriptors(new Map());
    setFreshness((previous) => (previous.size === 0 ? previous : new Map()));
  }, []);

  useEffect(() => {
    publishFreshness();
    if (descriptors.size === 0) {
      return;
    }
    const timer = setInterval(publishFreshness, FRESHNESS_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [descriptors, publishFreshness]);

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
    const nextSources = new Map<string, CrowdVideoSource>();
    const nextStates: CrowdSourceState[] = opened.map((entry) => {
      if (entry.descriptor) {
        nextDescriptors.set(entry.cameraEdgeId, entry.descriptor);
        nextSources.set(entry.cameraEdgeId, entry.source);
        return { key: entry.cameraEdgeId, status: "ready", error: null };
      }
      return {
        key: entry.cameraEdgeId,
        status: "error",
        error: describeError(entry.error),
      };
    });
    sourceByKeyRef.current = nextSources;
    descriptorsRef.current = nextDescriptors;
    setDescriptors(nextDescriptors);
    setSourceStates(nextStates);
    publishFreshness();

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
  }, [closeSources, describeError, initialSelectedKey, publishFreshness, t]);

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
    videoSources: descriptors,
    freshness,
    isFresh,
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
