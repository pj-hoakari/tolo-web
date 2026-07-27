import { memo } from "react";
import { Button } from "@/components/ui/button";
import type { DetectCrowdStatus } from "../hooks/useDetectCrowd";

export type CrowdDetectionControlsProps = {
  status: DetectCrowdStatus;
  onStart: () => void;
  onStop: () => void;
};

function CrowdDetectionControlsComponent({
  status,
  onStart,
  onStop,
}: CrowdDetectionControlsProps) {
  const isActive = status === "loading" || status === "detecting";

  return (
    <div className="flex gap-2">
      <Button type="button" onPress={onStart} isDisabled={isActive}>
        カメラを起動
      </Button>
      <Button
        type="button"
        variant="secondary"
        onPress={onStop}
        isDisabled={!isActive}
      >
        停止
      </Button>
    </div>
  );
}

export const CrowdDetectionControls = memo(CrowdDetectionControlsComponent);
