import { memo } from "react";
import { useStore } from "zustand";
import {
  type DetectionResultStore,
  selectMetrics,
} from "@/features/tenant/detection/stores/detectionStore";
import type { DetectCrowdStatus } from "../hooks/useDetectCrowd";

const STATUS_LABELS: Record<DetectCrowdStatus, string> = {
  idle: "停止中",
  loading: "起動中",
  detecting: "検出中",
  error: "エラー",
};

export type DetectionStatusPanelProps = {
  status: DetectCrowdStatus;
  resultStore: DetectionResultStore;
};

function DetectionStatusPanelComponent({
  status,
  resultStore,
}: DetectionStatusPanelProps) {
  const metrics = useStore(resultStore, selectMetrics);

  return (
    <section className="grid w-full max-w-3xl gap-4 rounded border border-gray-200 p-4 sm:grid-cols-3">
      <p>検出状態: {STATUS_LABELS[status]}</p>
      <p>追跡中人数: {metrics.trackedCount}人</p>
      <p>FPS: {metrics.fps.toFixed(1)}</p>
    </section>
  );
}

export const DetectionStatusPanel = memo(DetectionStatusPanelComponent);
