import type { YoloDetector } from "@pj-hoakari/web-crowd-detection-utils/yolo";

/** モデルや ONNX Runtime を使わず、毎フレーム「検出なし」を返す。 */
export function createMockCrowdDetector(): Pick<YoloDetector, "detect"> {
  return {
    detect: async () => [],
  };
}
