import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AliveEdgeList } from "@/features/tenant/webrtc/components/AliveEdgeList";

const meta = {
  title: "Tenant/WebRTC/AliveEdgeList",
  component: AliveEdgeList,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    onRefresh: () => {},
  },
} satisfies Meta<typeof AliveEdgeList>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleEdges = [
  {
    id: "tenant-1_event-1_8c1f0e2a",
    lastSeenAt: new Date("2026-06-14T10:00:00"),
  },
  {
    id: "tenant-1_event-1_3b9d77f4",
    lastSeenAt: new Date("2026-06-14T10:00:05"),
  },
];

export const Empty: Story = {
  args: {
    edges: [],
    status: "ready",
    error: null,
  },
};

export const Loading: Story = {
  args: {
    edges: [],
    status: "loading",
    error: null,
  },
};

export const WithEdges: Story = {
  args: {
    edges: sampleEdges,
    status: "ready",
    error: null,
  },
};

export const ErrorState: Story = {
  args: {
    edges: [],
    status: "error",
    error: "エッジ一覧の取得に失敗しました",
  },
};
