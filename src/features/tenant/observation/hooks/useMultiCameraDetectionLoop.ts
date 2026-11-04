import { type RefObject, useCallback, useEffect, useRef } from "react";
import {
  applyDetectedPeople,
  applyLineCounts,
  applyMetrics,
  areCountingLinesEqual,
  createInitialLineCounts,
  type DetectionResultStore,
  type DetectionSettingsStore,
  type DetectionViewStateStore,
  INITIAL_LINE_COUNT,
  INITIAL_METRICS,
  recordDetectedPeople,
  resetDetectedPeople,
} from "@/features/tenant/detection/stores/detectionStore";
import {
  type DetectionOverlayFrame,
  type DetectionOverlayLine,
  drawDetectionOverlay,
} from "@/features/tenant/webrtc/utils/detectionOverlay";
import {
  type BroadcastStreamHandle,
  createBroadcastStream,
} from "../utils/broadcastStream";
import {
  selectCameraSettingsStore,
  selectCameraViewStateStore,
  toCameraDetectionOptions,
} from "../utils/cameraDetectionSettings";
import {
  CAMERA_FRAME_COUNT,
  CAMERA_FRAME_INTERVAL_MS,
  type CameraCyclePhase,
  runCameraSchedulerCycle,
  type ScheduledCamera,
} from "../utils/cameraScheduler";
import {
  type CapturedCrowdFrame,
  type CrowdDetectionFrame,
  type CrowdDetectionState,
  captureCrowdFrame,
  createCrowdDetectionState,
  detectCapturedCrowdFrame,
  resetCrowdLineCount,
  resetCrowdTracking,
} from "../utils/detectCrowd";
import type { VideoSourceDescriptor } from "../utils/videoSource";
import type { DetectCrowdStatus } from "./useDetectCrowd";

const HIDDEN_VIDEO_STYLE =
  "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";

function syncCanvasSize(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): void {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function isVideoReady(
  video: HTMLVideoElement | null | undefined,
): video is HTMLVideoElement {
  return (
    !!video &&
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.videoWidth > 0 &&
    video.videoHeight > 0
  );
}

function toDetectionOverlayFrame(
  frame: CrowdDetectionFrame | null,
  countingLines: DetectionOverlayLine[],
  width: number,
  height: number,
): DetectionOverlayFrame {
  return {
    width,
    height,
    detections: (frame?.detections ?? []).map(
      ({ trackId, score, x1, y1, x2, y2 }) => ({
        trackId,
        score,
        x1,
        y1,
        x2,
        y2,
      }),
    ),
    countingLines,
    lineCounts:
      frame?.lineCounts ??
      Object.fromEntries(
        countingLines.map((line) => [line.id, INITIAL_LINE_COUNT]),
      ),
  };
}

function createHiddenVideo(
  descriptor: VideoSourceDescriptor,
): HTMLVideoElement {
  const video = document.createElement("video");
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute("aria-hidden", "true");
  video.tabIndex = -1;
  video.style.cssText = HIDDEN_VIDEO_STYLE;

  const play = () => {
    void video.play().catch(() => {
      // 自動再生が拒否された場合は次の canplay で再試行する
    });
  };

  if (descriptor.kind === "stream") {
    video.srcObject = descriptor.stream;
  } else {
    video.loop = descriptor.loop;
    video.src = descriptor.url;
  }
  video.addEventListener("canplay", play);
  document.body.appendChild(video);
  play();

  return video;
}

function disposeHiddenVideo(video: HTMLVideoElement): void {
  video.pause();
  video.srcObject = null;
  video.removeAttribute("src");
  video.load();
  video.remove();
}

export type MultiCameraDetectionLoopParams = {
  /** 開いた全カメラの映像ソース。選択中以外も検出に使う。 */
  sources: ReadonlyMap<string, VideoSourceDescriptor>;
  selectedKey: string | null;
  /** カメラの映像が新しく届いているか。false のカメラは取得も推論も飛ばす。 */
  isFresh: (key: string) => boolean;
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
  lineCanvasRef?: RefObject<HTMLCanvasElement | null>;
  status: DetectCrowdStatus;
  /** ローカルカメラ・開発用の共有ストア。カメラ用のストアがない場合に使う。 */
  settingsStore: DetectionSettingsStore;
  viewStateStore: DetectionViewStateStore;
  resultStore: DetectionResultStore;
  /** カメラごとの検出設定。 */
  cameraSettingsStores: ReadonlyMap<string, DetectionSettingsStore>;
  /** カメラごとの画面操作の状態。 */
  cameraViewStateStores: ReadonlyMap<string, DetectionViewStateStore>;
  /** カメラごとの結果。選択中でないカメラの計測報告にも使う。 */
  cameraResultStores: ReadonlyMap<string, DetectionResultStore>;
  onCameraPhase: (
    key: string,
    phase: CameraCyclePhase,
    error?: unknown,
  ) => void;
  onBroadcastStreamChange: (stream: MediaStream | null) => void;
  onDetectionFrame: (frame: DetectionOverlayFrame | null) => void;
};

/**
 * 複数カメラの検出ループ。
 *
 * すべてのカメラの映像を非表示の video 要素で再生したまま、
 * カメラごとに 5 枚取得して 1 枚ずつ推論する直列スケジューラを回す。
 * 選択中のカメラの結果だけを既存の resultStore / オーバーレイへ反映し、
 * 全カメラの結果は cameraResultStores に保持する。
 */
export function useMultiCameraDetectionLoop({
  sources,
  selectedKey,
  isFresh,
  overlayCanvasRef,
  lineCanvasRef,
  status,
  settingsStore,
  viewStateStore,
  resultStore,
  cameraSettingsStores,
  cameraViewStateStores,
  cameraResultStores,
  onCameraPhase,
  onBroadcastStreamChange,
  onDetectionFrame,
}: MultiCameraDetectionLoopParams): void {
  const broadcastRef = useRef<BroadcastStreamHandle | null>(null);
  const broadcastKeyRef = useRef<string | null>(null);
  const detectionStatesRef = useRef<Map<string, CrowdDetectionState>>(
    new Map(),
  );
  const latestOverlayFramesRef = useRef<Map<string, DetectionOverlayFrame>>(
    new Map(),
  );
  const selectedKeyRef = useRef<string | null>(selectedKey);
  const onCameraPhaseRef = useRef(onCameraPhase);
  const onDetectionFrameRef = useRef(onDetectionFrame);

  selectedKeyRef.current = selectedKey;
  onCameraPhaseRef.current = onCameraPhase;
  onDetectionFrameRef.current = onDetectionFrame;

  const disposeBroadcast = useCallback(() => {
    const broadcast = broadcastRef.current;
    if (!broadcast) {
      return;
    }
    broadcast.dispose();
    for (const track of broadcast.stream.getTracks()) {
      track.stop();
    }
    broadcastRef.current = null;
    onBroadcastStreamChange(null);
  }, [onBroadcastStreamChange]);

  // カウントラインが変わったら、そのカメラの通過数だけを数え直す
  useEffect(() => {
    const subscriptions: (() => void)[] = [];

    const resetCamera = (key: string | null) => {
      const settings = selectCameraSettingsStore(
        key,
        cameraSettingsStores,
        settingsStore,
      ).getState();
      const lineCounts = createInitialLineCounts(settings.countingLines);
      let affectsSelected: boolean;

      if (key === null) {
        for (const [cameraKey, state] of detectionStatesRef.current) {
          if (cameraSettingsStores.has(cameraKey)) {
            continue;
          }
          resetCrowdLineCount(state);
          latestOverlayFramesRef.current.delete(cameraKey);
          const result = cameraResultStores.get(cameraKey);
          if (result) {
            applyLineCounts(result, lineCounts);
          }
        }
        const selected = selectedKeyRef.current;
        affectsSelected =
          selected === null || !cameraSettingsStores.has(selected);
      } else {
        const state = detectionStatesRef.current.get(key);
        if (state) {
          resetCrowdLineCount(state);
        }
        latestOverlayFramesRef.current.delete(key);
        const result = cameraResultStores.get(key);
        if (result) {
          applyLineCounts(result, lineCounts);
        }
        affectsSelected = selectedKeyRef.current === key;
      }

      if (affectsSelected) {
        applyLineCounts(resultStore, lineCounts);
        onDetectionFrameRef.current(null);
      }
    };

    const watch = (store: DetectionSettingsStore, key: string | null) => {
      let previousCountingLines = store.getState().countingLines;
      subscriptions.push(
        store.subscribe(() => {
          const nextCountingLines = store.getState().countingLines;
          if (areCountingLinesEqual(previousCountingLines, nextCountingLines)) {
            return;
          }
          previousCountingLines = nextCountingLines;
          resetCamera(key);
        }),
      );
    };

    for (const [key, store] of cameraSettingsStores) {
      watch(store, key);
    }
    // ローカルカメラ・開発用の共有ストアも監視する
    watch(settingsStore, null);

    return () => {
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
    };
  }, [settingsStore, cameraSettingsStores, cameraResultStores, resultStore]);

  // 停止したら選択中の表示を初期状態へ戻す
  useEffect(() => {
    if (status === "detecting") {
      return;
    }
    const canvas = overlayCanvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    const lineCanvas = lineCanvasRef?.current;
    lineCanvas
      ?.getContext("2d")
      ?.clearRect(0, 0, lineCanvas.width, lineCanvas.height);

    const selectedSettings = selectCameraSettingsStore(
      selectedKeyRef.current,
      cameraSettingsStores,
      settingsStore,
    ).getState();
    applyLineCounts(
      resultStore,
      createInitialLineCounts(selectedSettings.countingLines),
    );
    applyMetrics(resultStore, INITIAL_METRICS);
    resetDetectedPeople(resultStore);
    for (const [key, store] of cameraResultStores) {
      const cameraSettings = selectCameraSettingsStore(
        key,
        cameraSettingsStores,
        settingsStore,
      ).getState();
      applyLineCounts(
        store,
        createInitialLineCounts(cameraSettings.countingLines),
      );
      applyMetrics(store, INITIAL_METRICS);
      resetDetectedPeople(store);
    }
    latestOverlayFramesRef.current.clear();
    onDetectionFrameRef.current(null);
  }, [
    status,
    lineCanvasRef,
    overlayCanvasRef,
    settingsStore,
    cameraSettingsStores,
    resultStore,
    cameraResultStores,
  ]);

  // 選択が変わったら、そのカメラの最新結果を既存の表示先へ移す
  useEffect(() => {
    if (status !== "detecting") {
      const selectedSettings = selectCameraSettingsStore(
        selectedKey,
        cameraSettingsStores,
        settingsStore,
      ).getState();
      applyLineCounts(
        resultStore,
        createInitialLineCounts(selectedSettings.countingLines),
      );
      applyMetrics(resultStore, INITIAL_METRICS);
      resetDetectedPeople(resultStore);
      onDetectionFrameRef.current(null);
      return;
    }

    const store = selectedKey ? cameraResultStores.get(selectedKey) : undefined;
    if (store) {
      const snapshot = store.getState();
      applyLineCounts(resultStore, snapshot.lineCounts);
      applyMetrics(resultStore, snapshot.metrics);
      applyDetectedPeople(resultStore, snapshot.detectedPeople);
    } else {
      const selectedSettings = selectCameraSettingsStore(
        selectedKey,
        cameraSettingsStores,
        settingsStore,
      ).getState();
      applyLineCounts(
        resultStore,
        createInitialLineCounts(selectedSettings.countingLines),
      );
      applyMetrics(resultStore, INITIAL_METRICS);
      resetDetectedPeople(resultStore);
    }

    onDetectionFrameRef.current(
      selectedKey
        ? (latestOverlayFramesRef.current.get(selectedKey) ?? null)
        : null,
    );
  }, [
    selectedKey,
    status,
    cameraResultStores,
    resultStore,
    cameraSettingsStores,
    settingsStore,
  ]);

  useEffect(() => {
    if (status !== "detecting" || sources.size === 0) {
      return;
    }

    let cancelled = false;
    let renderRafId = 0;
    const hiddenVideos = new Map<string, HTMLVideoElement>();
    const detectionStates = new Map<string, CrowdDetectionState>();
    const lastDetectionAt = new Map<string, number>();

    for (const [key, descriptor] of sources) {
      hiddenVideos.set(key, createHiddenVideo(descriptor));
      detectionStates.set(key, createCrowdDetectionState());
    }
    detectionStatesRef.current = detectionStates;
    latestOverlayFramesRef.current.clear();

    // この回の検出開始時点から、カメラごとのラインで数え直す
    for (const [key, store] of cameraResultStores) {
      const cameraSettings = selectCameraSettingsStore(
        key,
        cameraSettingsStores,
        settingsStore,
      ).getState();
      applyLineCounts(
        store,
        createInitialLineCounts(cameraSettings.countingLines),
      );
      applyMetrics(store, INITIAL_METRICS);
      resetDetectedPeople(store);
    }
    const selectedSettings = selectCameraSettingsStore(
      selectedKeyRef.current,
      cameraSettingsStores,
      settingsStore,
    ).getState();
    applyLineCounts(
      resultStore,
      createInitialLineCounts(selectedSettings.countingLines),
    );
    applyMetrics(resultStore, INITIAL_METRICS);
    resetDetectedPeople(resultStore);

    const updateCameraResult = (
      key: string,
      video: HTMLVideoElement,
      frame: CrowdDetectionFrame,
      countingLines: DetectionOverlayLine[],
    ) => {
      const now = performance.now();
      const previousDetectionAt = lastDetectionAt.get(key);
      const fps =
        previousDetectionAt === undefined
          ? 0
          : 1000 / Math.max(1, now - previousDetectionAt);
      lastDetectionAt.set(key, now);
      const metrics = {
        trackedCount: frame.detections.length,
        fps,
      };

      const store = cameraResultStores.get(key);
      if (store) {
        applyLineCounts(store, frame.lineCounts);
        applyMetrics(store, metrics);
        recordDetectedPeople(store, frame.detections.length);
      }

      const overlayFrame = toDetectionOverlayFrame(
        frame,
        countingLines,
        video.videoWidth,
        video.videoHeight,
      );
      latestOverlayFramesRef.current.set(key, overlayFrame);

      if (selectedKeyRef.current === key) {
        applyLineCounts(resultStore, frame.lineCounts);
        applyMetrics(resultStore, metrics);
        recordDetectedPeople(resultStore, frame.detections.length);
        onDetectionFrameRef.current(overlayFrame);
      }
    };

    const scheduledCameras: ScheduledCamera<CapturedCrowdFrame>[] = [];
    for (const [key, video] of hiddenVideos) {
      const state = detectionStates.get(key);
      if (!state) {
        continue;
      }
      scheduledCameras.push({
        key,
        isReady: () => isVideoReady(video),
        isFresh: () => isFresh(key),
        capture: () => captureCrowdFrame(video, state),
        infer: async (captured) => {
          if (cancelled) {
            return;
          }
          const currentSettings = selectCameraSettingsStore(
            key,
            cameraSettingsStores,
            settingsStore,
          ).getState();
          const detectionOptions = toCameraDetectionOptions(
            currentSettings,
            video.videoWidth,
            video.videoHeight,
          );
          const frame = await detectCapturedCrowdFrame(
            captured,
            detectionOptions,
            state,
          );
          if (cancelled) {
            return;
          }
          updateCameraResult(key, video, frame, detectionOptions.countingLines);
        },
        onPhase: (phase, error) => {
          if (!cancelled) {
            onCameraPhaseRef.current(key, phase, error);
          }
        },
      });
    }

    const wait = (ms: number): Promise<void> =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      });

    const runLoop = async () => {
      while (!cancelled) {
        await runCameraSchedulerCycle(scheduledCameras, {
          frameCount: CAMERA_FRAME_COUNT,
          frameIntervalMs: CAMERA_FRAME_INTERVAL_MS,
          wait,
          isCancelled: () => cancelled,
        });
        if (cancelled) {
          return;
        }
        // 直列スケジューラは全カメラを 1 周するため、周回後の待機は
        // 選択中のカメラの検出間隔に合わせる。
        const pause = selectCameraSettingsStore(
          selectedKeyRef.current,
          cameraSettingsStores,
          settingsStore,
        ).getState().detectionInterval;
        // 未準備・stale だけの周回でもタイマーや映像の復帰を進める。
        await wait(Math.max(16, pause));
      }
    };

    const renderLoop = () => {
      if (cancelled) {
        return;
      }

      for (const video of hiddenVideos.values()) {
        if (video.paused) {
          void video.play().catch(() => {
            // 次フレームで再試行する
          });
        }
      }

      const key = selectedKeyRef.current;
      const selectedVideo = key ? hiddenVideos.get(key) : undefined;

      // 選択が変わったら配信ストリームも選択中のカメラへ切り替える
      if (key !== broadcastKeyRef.current) {
        disposeBroadcast();
        broadcastKeyRef.current = key;
      }

      if (isVideoReady(selectedVideo)) {
        const width = selectedVideo.videoWidth;
        const height = selectedVideo.videoHeight;
        const overlay = overlayCanvasRef.current;
        if (overlay) {
          syncCanvasSize(overlay, width, height);
          const context = overlay.getContext("2d");
          if (context) {
            context.clearRect(0, 0, width, height);
            const selectedSettings = selectCameraSettingsStore(
              key,
              cameraSettingsStores,
              settingsStore,
            ).getState();
            const selectedViewState = selectCameraViewStateStore(
              key,
              cameraViewStateStores,
              viewStateStore,
            ).getState();
            const countingLines = toCameraDetectionOptions(
              selectedSettings,
              width,
              height,
            ).countingLines;
            const emptyFrame = toDetectionOverlayFrame(
              null,
              countingLines,
              width,
              height,
            );
            drawDetectionOverlay(
              context,
              (key ? latestOverlayFramesRef.current.get(key) : undefined) ??
                emptyFrame,
              {
                highlightedLineId: selectedViewState.editingLineId,
                lineCanvas: lineCanvasRef?.current,
              },
            );
          }
        }

        if (!broadcastRef.current) {
          const broadcast = createBroadcastStream(selectedVideo);
          if (broadcast) {
            for (const track of broadcast.stream.getVideoTracks()) {
              track.contentHint = "motion";
            }
            broadcastRef.current = broadcast;
            onBroadcastStreamChange(broadcast.stream);
          }
        }
      }

      renderRafId = requestAnimationFrame(renderLoop);
    };

    void runLoop();
    renderRafId = requestAnimationFrame(renderLoop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(renderRafId);
      disposeBroadcast();
      broadcastKeyRef.current = null;
      onDetectionFrameRef.current(null);
      for (const state of detectionStates.values()) {
        resetCrowdTracking(state);
      }
      if (detectionStatesRef.current === detectionStates) {
        detectionStatesRef.current = new Map();
      }
      latestOverlayFramesRef.current.clear();
      for (const video of hiddenVideos.values()) {
        disposeHiddenVideo(video);
      }
    };
  }, [
    status,
    sources,
    isFresh,
    settingsStore,
    viewStateStore,
    resultStore,
    cameraSettingsStores,
    cameraViewStateStores,
    cameraResultStores,
    overlayCanvasRef,
    lineCanvasRef,
    disposeBroadcast,
    onBroadcastStreamChange,
  ]);
}
