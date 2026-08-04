import { useTranslations } from "next-intl";
import { memo } from "react";
import { useStore } from "zustand";
import {
  type DetectionResultStore,
  selectMetrics,
} from "@/features/tenant/detection/stores/detectionStore";
import type { DetectCrowdStatus } from "../hooks/useDetectCrowd";

export type DetectionStatusPanelProps = {
  status: DetectCrowdStatus;
  resultStore: DetectionResultStore;
};

function DetectionStatusPanelComponent({
  status,
  resultStore,
}: DetectionStatusPanelProps) {
  const metrics = useStore(resultStore, selectMetrics);
  const t = useTranslations("Observation.status");

  return (
    <section className="grid w-full max-w-3xl gap-4 rounded border border-gray-200 p-4 sm:grid-cols-3">
      <p>{t("detection", { status: t(status) })}</p>
      <p>{t("trackedCount", { count: metrics.trackedCount })}</p>
      <p>{t("fps", { fps: metrics.fps.toFixed(1) })}</p>
    </section>
  );
}

export const DetectionStatusPanel = memo(DetectionStatusPanelComponent);
