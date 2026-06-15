import { isWebGpuAvailable } from "@pj-hoakari/web-crowd-detection-utils/onnx";
import {
  createYoloDetector,
  type YoloDetector,
} from "@pj-hoakari/web-crowd-detection-utils/yolo";

const MODEL_PATH =
  process.env.NEXT_PUBLIC_CROWD_DETECTION_MODEL_PATH ??
  "/models/person-detection.onnx";
const INPUT_SIZE = 640;

let detectorPromise: Promise<YoloDetector> | null = null;

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

export async function detectCrowd(source: MediaStream): Promise<MediaStream> {
  await initializeCrowdDetector();

  return source;
}
