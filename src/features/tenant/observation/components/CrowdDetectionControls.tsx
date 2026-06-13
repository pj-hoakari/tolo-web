import type { DetectCrowdStatus } from "../hooks/useDetectCrowd";

export type CrowdDetectionControlsProps = {
  status: DetectCrowdStatus;
  onStart: () => void;
  onStop: () => void;
};

export function CrowdDetectionControls({
  status,
  onStart,
  onStop,
}: CrowdDetectionControlsProps) {
  const isActive = status === "loading" || status === "detecting";

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onStart}
        disabled={isActive}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        カメラを起動
      </button>
      <button
        type="button"
        onClick={onStop}
        disabled={!isActive}
        className="rounded bg-gray-600 px-4 py-2 text-white disabled:opacity-50"
      >
        停止
      </button>
    </div>
  );
}
