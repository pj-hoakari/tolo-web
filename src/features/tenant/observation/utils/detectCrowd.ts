import { BackgroundSubtractor } from "@pj-hoakari/web-crowd-detection-utils/background";
import {
  BYTETracker,
  type TrackedBox,
} from "@pj-hoakari/web-crowd-detection-utils/bytetrack";
import {
  type Line,
  type LineCount,
  LineCrossingCounter,
} from "@pj-hoakari/web-crowd-detection-utils/line-crossing";
import { isWebGpuAvailable } from "@pj-hoakari/web-crowd-detection-utils/onnx";
import {
  createLetterboxCapturer,
  reverseLetterboxBoxes,
} from "@pj-hoakari/web-crowd-detection-utils/source";
import {
  createYoloDetector,
  type Detection,
  type YoloDetector,
} from "@pj-hoakari/web-crowd-detection-utils/yolo";

const MODEL_PATH =
  process.env.NEXT_PUBLIC_CROWD_DETECTION_MODEL_PATH ?? "/models/yolo26n.onnx";
// Path under which the ONNX Runtime WASM assets are served. They are copied
// into `public/onnxruntime/` at build time by the `wcdu-copy-runtime-assets`
// CLI (see package.json scripts), so the runtime loads them from here instead
// of relying on the bundler to emit them.
const ONNX_RUNTIME_PATH = "/onnxruntime/";
const INPUT_SIZE = 640;
const STATIC_SUPPRESS_FACTOR = 0.3;

let detectorPromise: Promise<YoloDetector> | null = null;
let capturer: ReturnType<typeof createLetterboxCapturer> | null = null;
const tracker = new BYTETracker();
const lineCrossingCounter = new LineCrossingCounter();
const backgroundSubtractor = new BackgroundSubtractor({
  width: INPUT_SIZE,
  height: INPUT_SIZE,
  alpha: 0.005,
});

export type TrackedDetection = TrackedBox & Pick<Detection, "classId">;

export type CrowdDetectionFrame = {
  detections: TrackedDetection[];
  detectedCount: number;
  totalTrackedCount: number;
  countingLine: Line;
  lineCount: LineCount;
};

export type CrowdDetectionOptions = {
  confidenceThreshold: number;
  trackingDistanceThreshold: number;
};

async function fetchModel(): Promise<ArrayBuffer> {
  const response = await fetch(MODEL_PATH);

  if (!response.ok) {
    throw new Error(
      `検出モデルの読み込みに失敗しました (${response.status}: ${MODEL_PATH})`,
    );
  }

  return response.arrayBuffer();
}

async function createPersonDetector(): Promise<YoloDetector> {
  const modelBuffer = await fetchModel();
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

export function initializeCrowdDetector(): Promise<YoloDetector> {
  detectorPromise ??= createPersonDetector().catch((error) => {
    detectorPromise = null;
    throw error;
  });

  return detectorPromise;
}

export async function detectCrowdFrame(
  video: HTMLVideoElement,
  options: CrowdDetectionOptions,
): Promise<CrowdDetectionFrame> {
  const detector = await initializeCrowdDetector();
  capturer ??= createLetterboxCapturer({ inputSize: INPUT_SIZE });
  const { imageData, params } = capturer.capture(video);
  let detections = await detector.detect(imageData);
  const backgroundReady = backgroundSubtractor.update(imageData);

  if (backgroundReady) {
    detections = backgroundSubtractor.suppressStatic(
      detections,
      STATIC_SUPPRESS_FACTOR,
    );
  }

  detections = detections.filter(
    (detection) => detection.score >= options.confidenceThreshold,
  );

  const sourceDetections = reverseLetterboxBoxes(detections, params);
  tracker.matchThresh = options.trackingDistanceThreshold;
  const trackedDetections = tracker.update(sourceDetections);
  const countingLine: Line = {
    id: "observation-line",
    p1: { x: 0, y: params.sourceHeight * 0.6 },
    p2: { x: params.sourceWidth, y: params.sourceHeight * 0.6 },
  };
  const trackedPoints = trackedDetections.map((detection) => ({
    trackId: detection.trackId,
    point: {
      x: (detection.x1 + detection.x2) / 2,
      y: detection.y2,
    },
  }));

  lineCrossingCounter.update(trackedPoints, [countingLine], {
    assist: {
      enabled: true,
      rescueDistance: params.sourceWidth * (60 / INPUT_SIZE),
    },
  });

  return {
    detections: trackedDetections,
    detectedCount: sourceDetections.length,
    totalTrackedCount: tracker.totalCount,
    countingLine,
    lineCount: lineCrossingCounter.getLineCount(countingLine.id),
  };
}

export function resetCrowdTracking(): void {
  tracker.reset();
  lineCrossingCounter.reset();
  backgroundSubtractor.reset();
}
