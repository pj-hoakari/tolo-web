import type { CameraCyclePhase } from "./cameraScheduler";

export type CameraStatusKey = CameraCyclePhase;

/**
 * カメラのタブに表示する状態を決める。
 * 取得・推論のフェーズより、ソースや推論のエラーを優先する。
 */
export function resolveCameraStatusKey({
  phase,
  stale = false,
  hasError = false,
}: {
  phase?: CameraCyclePhase | null;
  stale?: boolean;
  hasError?: boolean;
}): CameraStatusKey {
  if (hasError || phase === "error") {
    return "error";
  }
  if (stale || phase === "stale") {
    return "stale";
  }
  return phase ?? "waiting";
}

export const CAMERA_STATUS_DOT_CLASS: Record<CameraStatusKey, string> = {
  capturing: "bg-sky-500",
  inferring: "bg-emerald-500",
  ready: "bg-emerald-500",
  waiting: "bg-muted-foreground",
  stale: "bg-amber-500",
  error: "bg-destructive",
};
