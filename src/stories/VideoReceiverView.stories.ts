import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { createDetectionStores } from "@/features/tenant/detection/stores/detectionStore";
import { VideoReceiverView } from "@/features/tenant/webrtc/components/VideoReceiverView";
import {
  type DetectionOverlayFrame,
  toOverlayCountingLines,
} from "@/features/tenant/webrtc/utils/detectionOverlay";

const meta = {
  title: "Tenant/WebRTC/VideoReceiverView",
  component: VideoReceiverView,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    stream: null,
    error: null,
  },
} satisfies Meta<typeof VideoReceiverView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Connecting: Story = {
  args: {
    status: "connecting",
  },
};

export const Negotiating: Story = {
  args: {
    status: "negotiating",
  },
};

export const Connected: Story = {
  args: {
    status: "connected",
  },
};

export const ErrorState: Story = {
  args: {
    status: "error",
    error: "接続に失敗しました",
  },
};

// 管理ページからカウントラインを編集できる状態
const editableStores = createDetectionStores();

const editableFrame: DetectionOverlayFrame = {
  width: 960,
  height: 540,
  detections: [{ trackId: 1, score: 0.82, x1: 380, y1: 180, x2: 500, y2: 470 }],
  countingLines: toOverlayCountingLines(
    editableStores.settingsStore.getState().countingLines,
    960,
    540,
  ),
  lineCounts: { "line-1": { forward: 3, backward: 1 } },
};

export const Editable: Story = {
  args: {
    status: "connected",
    detectionFrameRef: { current: editableFrame },
    settingsStore: editableStores.settingsStore,
    viewStateStore: editableStores.viewStateStore,
  },
};
