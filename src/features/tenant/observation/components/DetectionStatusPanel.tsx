import { useTranslations } from "next-intl";
import { memo } from "react";
import { useStore } from "zustand";
import {
  type DetectionResultStore,
  selectMetrics,
} from "@/features/tenant/detection/stores/detectionStore";
import { cn } from "@/lib/utils";
import type { DetectCrowdStatus } from "../hooks/useDetectCrowd";

export type DetectionStatusPanelProps = {
  status: DetectCrowdStatus;
  resultStore: DetectionResultStore;
  /** ESP モードではタブが検出状態を示すため、状態行を隠せる。 */
  showDetectionStatus?: boolean;
};

function DetectionStatusPanelComponent({
  status,
  resultStore,
  showDetectionStatus = true,
}: DetectionStatusPanelProps) {
  const metrics = useStore(resultStore, selectMetrics);
  const t = useTranslations("Observation.status");

  return (
    <section
      className={cn(
        "grid w-full max-w-3xl gap-4 rounded border border-border p-4",
        showDetectionStatus ? "sm:grid-cols-3" : "sm:grid-cols-2",
      )}
    >
      {showDetectionStatus && <p>{t("detection", { status: t(status) })}</p>}
      <p>{t("trackedCount", { count: metrics.trackedCount })}</p>
      <p>{t("fps", { fps: metrics.fps.toFixed(1) })}</p>
    </section>
  );
}

export const DetectionStatusPanel = memo(DetectionStatusPanelComponent);
