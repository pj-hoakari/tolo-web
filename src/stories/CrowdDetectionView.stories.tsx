import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useRef, useState } from "react";

import {
  CrowdDetectionView,
  type CrowdDetectionViewProps,
} from "@/features/tenant/observation/components/CrowdDetectionView";
import {
  type DetectionMetrics,
  INITIAL_METRICS,
  INITIAL_SETTINGS,
} from "@/features/tenant/observation/hooks/useCrowdDetectionLoop";

// videoRef / overlayCanvasRef は Story 側の wrapper で生成
// 設定は内部 state で扱う
type StoryArgs = Omit<
  CrowdDetectionViewProps,
  "videoRef" | "overlayCanvasRef" | "onSettingsChange"
>;

function CrowdDetectionViewStory({
  settings: initialSettings,
  ...rest
}: StoryArgs) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [settings, setSettings] = useState(initialSettings);

  return (
    <CrowdDetectionView
      {...rest}
      settings={settings}
      onSettingsChange={setSettings}
      videoRef={videoRef}
      overlayCanvasRef={overlayCanvasRef}
    />
  );
}

const detectingMetrics: DetectionMetrics = {
  detectedCount: 2,
  trackedCount: 2,
  totalTrackedCount: 5,
  fps: 23.4,
  lastDetectedAt: new Date("2026-06-20T12:00:00"),
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
