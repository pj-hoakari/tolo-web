import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AliveEdgeList } from "@/features/tenant/webrtc/components/AliveEdgeList";
import { SAMPLE_EVENT_ID, sampleEdgeDeviceItems } from "@/mocks/fixtures/edges";

const meta = {
  title: "Tenant/WebRTC/AliveEdgeList",
  component: AliveEdgeList,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    eventId: SAMPLE_EVENT_ID,
    onRefresh: () => {},
    onConnect: () => {},
    onDisconnect: () => {},
    onUnregistered: () => {},
    connectedEdgeId: null,
    receiveStatus: "idle",
  },
} satisfies Meta<typeof AliveEdgeList>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleEdges = sampleEdgeDeviceItems;

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

export const Connected: Story = {
  args: {
    edges: sampleEdges,
    status: "ready",
    error: null,
    connectedEdgeId: sampleEdges[0].edgeDeviceId,
    receiveStatus: "connected",
  },
};

export const Disconnected: Story = {
  args: {
    edges: sampleEdges,
    status: "ready",
    error: null,
    connectedEdgeId: sampleEdges[0].edgeDeviceId,
    receiveStatus: "disconnected",
  },
};

export const ErrorState: Story = {
  args: {
    edges: [],
    status: "error",
    error: "エッジ一覧の取得に失敗しました",
  },
};
