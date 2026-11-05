import { memo, type RefObject } from "react";
import { DetectionLineCountList } from "@/features/tenant/detection/components/DetectionLineCountList";
import { DetectionSettingsPanel } from "@/features/tenant/detection/components/DetectionSettingsPanel";
import type {
  DetectionResultStore,
  DetectionSettingsStore,
  DetectionViewStateStore,
} from "@/features/tenant/detection/stores/detectionStore";
import type { DetectCrowdStatus } from "../hooks/useDetectCrowd";
import type { VideoSourceDescriptor } from "../utils/videoSource";
import { DetectionStatusPanel } from "./DetectionStatusPanel";
import { DetectionVideoStage } from "./DetectionVideoStage";

export type CrowdDetectionViewProps = {
  videoSource: VideoSourceDescriptor | null;
  status: DetectCrowdStatus;
  error: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
  lineCanvasRef?: RefObject<HTMLCanvasElement | null>;
  settingsStore: DetectionSettingsStore;
  resultStore: DetectionResultStore;
  viewStateStore: DetectionViewStateStore;
  showDetectionStatus?: boolean;
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
  lineCanvasRef,
  settingsStore,
  resultStore,
  viewStateStore,
  showDetectionStatus = true,
}: CrowdDetectionViewProps) {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <DetectionVideoStage
        videoSource={videoSource}
        status={status}
        videoRef={videoRef}
        overlayCanvasRef={overlayCanvasRef}
        lineCanvasRef={lineCanvasRef}
        settingsStore={settingsStore}
        viewStateStore={viewStateStore}
      />
      <DetectionLineCountList
        settingsStore={settingsStore}
        resultStore={resultStore}
        viewStateStore={viewStateStore}
      />
      <DetectionStatusPanel
        status={status}
        resultStore={resultStore}
        showDetectionStatus={showDetectionStatus}
      />
      <DetectionSettingsPanel
        settingsStore={settingsStore}
        viewStateStore={viewStateStore}
        resultStore={resultStore}
        showLineCreationModeToggle={false}
      />
      {status === "error" && error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export const CrowdDetectionView = memo(CrowdDetectionViewComponent);
