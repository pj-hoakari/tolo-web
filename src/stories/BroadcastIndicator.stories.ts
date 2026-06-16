import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BroadcastIndicator } from "@/features/tenant/webrtc/components/BroadcastIndicator";

const meta = {
  title: "Tenant/WebRTC/BroadcastIndicator",
  component: BroadcastIndicator,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof BroadcastIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleEdgeId = "tenant-1_event-1_8c1f0e2a";

export const Stopped: Story = {
  args: {
    active: false,
    edgeId: null,
  },
};

export const Broadcasting: Story = {
  args: {
    active: true,
    edgeId: sampleEdgeId,
  },
};
