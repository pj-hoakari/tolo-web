import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, useRef, useState } from "react";
import {
  applyLineCounts,
  applyMetrics,
  createDetectionStores,
  type DetectionLineCount,
  type DetectionMetrics,
  type DetectionSettings,
  INITIAL_METRICS,
  INITIAL_SETTINGS,
} from "@/features/tenant/detection/stores/detectionStore";
import {
  CrowdDetectionView,
  type CrowdDetectionViewProps,
} from "@/features/tenant/observation/components/CrowdDetectionView";

// videoRef / overlayCanvasRef は Story 側の wrapper で生成
// 設定・検出結果はストア経由で渡す
type StoryArgs = Omit<
  CrowdDetectionViewProps,
  | "videoRef"
  | "overlayCanvasRef"
  | "settingsStore"
  | "resultStore"
  | "viewStateStore"
> & {
  settings: DetectionSettings;
  lineCounts: Record<string, DetectionLineCount>;
  metrics: DetectionMetrics;
};

function CrowdDetectionViewStory({
  settings,
  lineCounts,
  metrics,
  ...rest
}: StoryArgs) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stores] = useState(() => createDetectionStores(settings));

  useEffect(() => {
    stores.settingsStore.setState(settings, true);
  }, [stores, settings]);

  useEffect(() => {
    applyLineCounts(stores.resultStore, lineCounts);
  }, [stores, lineCounts]);

  useEffect(() => {
    applyMetrics(stores.resultStore, metrics);
  }, [stores, metrics]);

  return (
    <CrowdDetectionView
      {...rest}
      videoRef={videoRef}
      overlayCanvasRef={overlayCanvasRef}
      settingsStore={stores.settingsStore}
      resultStore={stores.resultStore}
      viewStateStore={stores.viewStateStore}
    />
  );
}

const detectingMetrics: DetectionMetrics = {
  trackedCount: 2,
  fps: 23.4,
};

const meta = {
  title: "Tenant/Observation/CrowdDetectionView",
  component: CrowdDetectionViewStory,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: { type: "inline-radio" },
      options: ["idle", "loading", "detecting", "error"],
    },
  },
  args: {
    videoSource: null,
    status: "idle",
    error: null,
    lineCounts: { "line-1": { forward: 0, backward: 0 } },
    metrics: INITIAL_METRICS,
    settings: INITIAL_SETTINGS,
  },
} satisfies Meta<typeof CrowdDetectionViewStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const Loading: Story = {
  args: { status: "loading" },
};

export const Detecting: Story = {
  args: {
    status: "detecting",
    lineCounts: { "line-1": { forward: 12, backward: 7 } },
    metrics: detectingMetrics,
  },
};

export const ErrorState: Story = {
  args: {
    status: "error",
    error: "検出器の初期化に失敗しました",
  },
};
