/**
 * 複数カメラを 1 台ずつ直列に処理するスケジューラ。
 *
 * 1 台のカメラについて 300ms 間隔で 5 枚のフレームを取得し、取得が
 * 終わってから 1 枚ずつ推論する。推論が終わるまで次のカメラの取得は
 * 始めない。映像が来ていない・エラーになったカメラはその回を飛ばす。
 */

export const CAMERA_FRAME_COUNT = 5;
export const CAMERA_FRAME_INTERVAL_MS = 300;

export type CameraCyclePhase =
  | "waiting"
  | "stale"
  | "capturing"
  | "inferring"
  | "ready"
  | "skipped"
  | "error";

export type CameraCycleOutcome = {
  key: string;
  status: "completed" | "skipped" | "error";
  error?: unknown;
};

export type ScheduledCamera<TFrame> = {
  key: string;
  /** この回にフレームを取得できる状態か（映像が来ているか）。 */
  isReady: () => boolean;
  /**
   * 映像が新しく届いているか。省略時は常に新しいとみなす。
   * `isReady` が true でもこれが false なら、凍結したフレームは取得しない。
   */
  isFresh?: () => boolean;
  /** 同期的に 1 枚取得する。失敗は例外で伝える。 */
  capture: () => TFrame;
  /** 取得済みの 1 枚を推論する。5 枚をまとめて渡さない。 */
  infer: (frame: TFrame) => Promise<void> | void;
  /** UI 表示用のフェーズ通知。省略可。 */
  onPhase?: (phase: CameraCyclePhase, error?: unknown) => void;
};

export type CameraSchedulerCycleOptions = {
  frameCount?: number;
  frameIntervalMs?: number;
  /** テスト用に差し替えられる待機関数。 */
  wait?: (ms: number) => Promise<void>;
  /** 停止要求。各ステップの境界で確認する。 */
  isCancelled?: () => boolean;
};

const defaultWait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * すべてのカメラを順番に 1 周処理する。
 *
 * 取得はカメラごとに `frameIntervalMs` 間隔（初回は即時）で
 * `frameCount` 枚。取得が途中で失敗したらそのカメラの推論は行わず、
 * 次のカメラへ進む。推論が失敗した場合も同様に次のカメラへ進む。
 */
export async function runCameraSchedulerCycle<TFrame>(
  cameras: readonly ScheduledCamera<TFrame>[],
  options: CameraSchedulerCycleOptions = {},
): Promise<CameraCycleOutcome[]> {
  const frameCount = Math.max(
    1,
    Math.floor(options.frameCount ?? CAMERA_FRAME_COUNT),
  );
  const frameIntervalMs = Math.max(
    0,
    options.frameIntervalMs ?? CAMERA_FRAME_INTERVAL_MS,
  );
  const wait = options.wait ?? defaultWait;
  const isCancelled = options.isCancelled ?? (() => false);
  const outcomes: CameraCycleOutcome[] = [];

  for (const camera of cameras) {
    if (isCancelled()) {
      break;
    }

    const isFresh = () => camera.isFresh?.() ?? true;

    if (!camera.isReady()) {
      camera.onPhase?.("waiting");
      outcomes.push({ key: camera.key, status: "skipped" });
      continue;
    }

    if (!isFresh()) {
      camera.onPhase?.("stale");
      outcomes.push({ key: camera.key, status: "skipped" });
      continue;
    }

    const frames: TFrame[] = [];
    let skipPhase: "waiting" | "stale" | null = null;
    camera.onPhase?.("capturing");

    try {
      for (let index = 0; index < frameCount; index += 1) {
        if (index > 0) {
          await wait(frameIntervalMs);
        }
        if (isCancelled()) {
          return outcomes;
        }
        if (!camera.isReady()) {
          skipPhase = "waiting";
          break;
        }
        if (!isFresh()) {
          skipPhase = "stale";
          break;
        }
        frames.push(camera.capture());
      }
    } catch (error) {
      if (isCancelled()) {
        return outcomes;
      }
      camera.onPhase?.("error", error);
      outcomes.push({ key: camera.key, status: "error", error });
      continue;
    }

    if (skipPhase) {
      camera.onPhase?.(skipPhase);
      outcomes.push({ key: camera.key, status: "skipped" });
      continue;
    }

    if (isCancelled()) {
      return outcomes;
    }

    camera.onPhase?.("inferring");
    try {
      for (const frame of frames) {
        if (isCancelled()) {
          return outcomes;
        }
        await camera.infer(frame);
      }
    } catch (error) {
      if (isCancelled()) {
        return outcomes;
      }
      camera.onPhase?.("error", error);
      outcomes.push({ key: camera.key, status: "error", error });
      continue;
    }

    camera.onPhase?.("ready");
    outcomes.push({ key: camera.key, status: "completed" });
  }

  return outcomes;
}
