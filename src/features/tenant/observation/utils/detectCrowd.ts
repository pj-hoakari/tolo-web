import { BackgroundSubtractor } from "@pj-hoakari/web-crowd-detection-utils/background";
import {
  BYTETracker,
  type TrackedBox,
} from "@pj-hoakari/web-crowd-detection-utils/bytetrack";
import {
  type Line,
  type LineCount,
  LineCrossingCounter,
  type Point,
} from "@pj-hoakari/web-crowd-detection-utils/line-crossing";
import { isWebGpuAvailable } from "@pj-hoakari/web-crowd-detection-utils/onnx";
import {
  createLetterboxCapturer,
  type LetterboxCaptureResult,
  reverseLetterboxBoxes,
} from "@pj-hoakari/web-crowd-detection-utils/source";
import {
  createYoloDetector,
  type Detection,
  type YoloDetector,
} from "@pj-hoakari/web-crowd-detection-utils/yolo";

// ブラウザがモデルを取得する配信URL
const MODEL_PATH =
  process.env.NEXT_PUBLIC_CROWD_DETECTION_MODEL_PATH ?? "/models/yolo26n.onnx";

// Path under which the ONNX Runtime WASM assets are served. They are copied
// into `public/onnxruntime/` at build time by the `wcdu-copy-runtime-assets`
// CLI (see package.json scripts), so the runtime loads them from here instead
// of relying on the bundler to emit them.
const ONNX_RUNTIME_PATH = "/onnxruntime/";
const INPUT_SIZE = 640;
const STATIC_SUPPRESS_FACTOR = 0.3;

type CrowdDetector = Pick<YoloDetector, "detect">;

let detectorPromise: Promise<CrowdDetector> | null = null;
// The detector reuses a single preprocessing buffer across detect calls.
let detectorQueue: Promise<void> = Promise.resolve();

async function runDetector<T>(run: () => Promise<T>): Promise<T> {
  const result = detectorQueue.then(run);
  detectorQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * カメラごとに独立して持つ検出状態。
 *
 * 検出器（ONNX セッション）はモジュールで共有し、追跡・ライン計数・
 * 背景差分・前処理はこの状態ごとに分ける。
 */
export type CrowdDetectionState = {
  tracker: BYTETracker;
  lineCrossingCounter: LineCrossingCounter;
  backgroundSubtractor: BackgroundSubtractor;
  capturer: ReturnType<typeof createLetterboxCapturer> | null;
};

export function createCrowdDetectionState(): CrowdDetectionState {
  return {
    tracker: new BYTETracker(),
    lineCrossingCounter: new LineCrossingCounter(),
    backgroundSubtractor: new BackgroundSubtractor({
      width: INPUT_SIZE,
      height: INPUT_SIZE,
      alpha: 0.005,
    }),
    capturer: null,
  };
}

/**
 * 既存の単一カメラ呼び出し（`useDetectCrowd` など）がそのまま使える
 * 既定の状態。複数カメラではカメラごとに `createCrowdDetectionState` を作る。
 */
const defaultState = createCrowdDetectionState();

export type CapturedCrowdFrame = LetterboxCaptureResult;

export type TrackedDetection = TrackedBox & Pick<Detection, "classId">;
export type CrowdCountingLine = Line;

export type CrowdDetectionFrame = {
  detections: TrackedDetection[];
  detectedCount: number;
  totalTrackedCount: number;
  countingLines: Line[];
  lineCounts: Record<string, LineCount>;
};

export type CrowdDetectionOptions = {
  confidenceThreshold: number;
  trackingDistanceThreshold: number;
  countingLines: CrowdCountingLine[];
};

/**
 * 検出モデルの取得に失敗したことを表すエラー。
 * 文言はロケールを知る呼び出し側（`useDetectCrowd`）で組み立てる。
 */
export class DetectionModelLoadError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`Failed to load the detection model (${status}: ${path})`);
    this.name = "DetectionModelLoadError";
  }
}

async function fetchModel(): Promise<ArrayBuffer> {
  const response = await fetch(MODEL_PATH);

  if (!response.ok) {
    throw new DetectionModelLoadError(response.status, MODEL_PATH);
  }

  return response.arrayBuffer();
}

async function createPersonDetector(): Promise<CrowdDetector> {
  const modelBuffer = await fetchModel();
  // 取得失敗・待機・再試行は実際の処理を通し、推論だけを置き換える。
  if (process.env.NEXT_PUBLIC_CROWD_DETECTION_MOCKING === "enabled") {
    const { createMockCrowdDetector } = await import("@/mocks/crowdDetector");
    return createMockCrowdDetector();
  }

  const preferredBackend = isWebGpuAvailable() ? "webgpu" : "wasm";
  const options = {
    modelPath: modelBuffer,
    inputSize: INPUT_SIZE,
    postprocess: {
      format: "auto" as const,
      classFilter: [0],
      confThreshold: 0.05,
    },
    session: {
      wasmPaths: ONNX_RUNTIME_PATH,
      sessionOptions: {
        // WebGPU 利用時、shape 系ノードが意図的に CPU へ割り当てられることによる
        // 既知の無害な警告（VerifyEachNodeIsAssignedToAnEp）がセッション作成のたびに
        // 出力されるため、セッションのログはエラー以上のみに絞る。
        logSeverityLevel: 3 as const,
      },
    },
  };

  try {
    return await createYoloDetector({
      ...options,
      executionProvider: preferredBackend,
    });
  } catch (error) {
    if (preferredBackend !== "webgpu") {
      throw error;
    }

    return createYoloDetector({
      ...options,
      executionProvider: "wasm",
    });
  }
}

export function initializeCrowdDetector(): Promise<CrowdDetector> {
  detectorPromise ??= createPersonDetector().catch((error) => {
    detectorPromise = null;
    throw error;
  });

  return detectorPromise;
}

export function footPoint({
  x1,
  x2,
  y2,
}: Pick<TrackedBox, "x1" | "x2" | "y2">): Point {
  return { x: (x1 + x2) / 2, y: y2 };
}

/**
 * 映像から 1 フレームを取得する。取得と推論を分け、複数カメラの
 * スケジューラが「5 枚取得してから推論する」順序を守れるようにする。
 */
export function captureCrowdFrame(
  video: HTMLVideoElement,
  state: CrowdDetectionState = defaultState,
): CapturedCrowdFrame {
  state.capturer ??= createLetterboxCapturer({ inputSize: INPUT_SIZE });
  return state.capturer.capture(video);
}

export async function detectCapturedCrowdFrame(
  captured: CapturedCrowdFrame,
  options: CrowdDetectionOptions,
  state: CrowdDetectionState = defaultState,
  isCancelled: () => boolean = () => false,
): Promise<CrowdDetectionFrame> {
  const detector = await initializeCrowdDetector();
  const { imageData, params } = captured;
  const detectionsOrNull = await runDetector(() =>
    isCancelled() ? Promise.resolve(null) : detector.detect(imageData),
  );
  if (isCancelled() || detectionsOrNull === null) {
    throw new Error("Detection cancelled");
  }
  let detections = detectionsOrNull;
  const backgroundReady = state.backgroundSubtractor.update(imageData);

  if (backgroundReady) {
    detections = state.backgroundSubtractor.suppressStatic(
      detections,
      STATIC_SUPPRESS_FACTOR,
    );
  }

  detections = detections.filter(
    (detection) => detection.score >= options.confidenceThreshold,
  );

  const sourceDetections = reverseLetterboxBoxes(detections, params);
  state.tracker.matchThresh = options.trackingDistanceThreshold;
  const trackedDetections = state.tracker.update(sourceDetections);
  const countingLines = options.countingLines;
  const trackedPoints = trackedDetections.map((detection) => ({
    trackId: detection.trackId,
    point: footPoint(detection),
  }));

  state.lineCrossingCounter.update(trackedPoints, countingLines, {
    assist: {
      enabled: true,
      rescueDistance: params.sourceWidth * (60 / INPUT_SIZE),
    },
  });

  return {
    detections: trackedDetections,
    detectedCount: sourceDetections.length,
    totalTrackedCount: state.tracker.totalCount,
    countingLines,
    lineCounts: Object.fromEntries(
      countingLines.map((line) => [
        line.id,
        state.lineCrossingCounter.getLineCount(line.id),
      ]),
    ),
  };
}

export async function detectCrowdFrame(
  video: HTMLVideoElement,
  options: CrowdDetectionOptions,
  state: CrowdDetectionState = defaultState,
): Promise<CrowdDetectionFrame> {
  return detectCapturedCrowdFrame(
    captureCrowdFrame(video, state),
    options,
    state,
  );
}

export function resetCrowdTracking(
  state: CrowdDetectionState = defaultState,
): void {
  state.tracker.reset();
  state.lineCrossingCounter.reset();
  state.backgroundSubtractor.reset();
}

export function resetCrowdLineCount(
  state: CrowdDetectionState = defaultState,
): void {
  state.lineCrossingCounter.reset();
}
