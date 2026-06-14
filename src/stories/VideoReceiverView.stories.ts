import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { VideoReceiverView } from "@/features/tenant/webrtc/components/VideoReceiverView";

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
