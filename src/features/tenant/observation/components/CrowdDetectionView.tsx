import { memo, type RefObject } from "react";
import type { DetectCrowdStatus } from "../hooks/useDetectCrowd";
import type {
  DetectionResultStore,
  DetectionSettingsStore,
  DetectionViewStateStore,
} from "../stores/detectionStore";
import type { VideoSourceDescriptor } from "../utils/videoSource";
import { DetectionLineCountList } from "./DetectionLineCountList";
import { DetectionSettingsPanel } from "./DetectionSettingsPanel";
import { DetectionStatusPanel } from "./DetectionStatusPanel";
import { DetectionVideoStage } from "./DetectionVideoStage";

export type CrowdDetectionViewProps = {
  videoSource: VideoSourceDescriptor | null;
  status: DetectCrowdStatus;
  error: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
  settingsStore: DetectionSettingsStore;
  resultStore: DetectionResultStore;
  viewStateStore: DetectionViewStateStore;
};

/**
 * 検出画面の組み立て
 */
function CrowdDetectionViewComponent({
  videoSource,
  status,
  error,
  videoRef,
  overlayCanvasRef,
  settingsStore,
  resultStore,
  viewStateStore,
}: CrowdDetectionViewProps) {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <DetectionVideoStage
        videoSource={videoSource}
        status={status}
        videoRef={videoRef}
        overlayCanvasRef={overlayCanvasRef}
        settingsStore={settingsStore}
        viewStateStore={viewStateStore}
      />
      <DetectionLineCountList
        settingsStore={settingsStore}
        resultStore={resultStore}
        viewStateStore={viewStateStore}
      />
      <DetectionStatusPanel status={status} resultStore={resultStore} />
      <DetectionSettingsPanel
        settingsStore={settingsStore}
        viewStateStore={viewStateStore}
      />
      {status === "error" && error && <p className="text-red-600">{error}</p>}
    </div>
  );
}

export const CrowdDetectionView = memo(CrowdDetectionViewComponent);
