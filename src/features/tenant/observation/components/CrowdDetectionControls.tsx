import { useTranslations } from "next-intl";
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
  const t = useTranslations("Observation.controls");

  return (
    <div className="flex gap-2">
      <Button type="button" onPress={onStart} isDisabled={isActive}>
        {t("start")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        onPress={onStop}
        isDisabled={!isActive}
      >
        {t("stop")}
      </Button>
    </div>
  );
}

export const CrowdDetectionControls = memo(CrowdDetectionControlsComponent);
