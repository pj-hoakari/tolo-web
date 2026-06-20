import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PropertiesPanel } from "@/features/tenant/management/components/PropertiesPanel";
import { PLACEHOLDER_GRAPH } from "@/features/tenant/management/placeholderGraph";
import type { AliveEdge } from "@/features/tenant/webrtc/type";

const { nodes, edges } = PLACEHOLDER_GRAPH;

// 紐づけ候補となる観測点（接続中のエッジ）のサンプル
const observationPoints: AliveEdge[] = [
  { id: "demo_event_cam-entrance", lastSeenAt: null },
  { id: "demo_event_cam-hall", lastSeenAt: null },
  { id: "demo_event_cam-booth-a", lastSeenAt: null },
];

const meta = {
  title: "Tenant/Management/PropertiesPanel",
  component: PropertiesPanel,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ display: "flex", height: 480 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    nodes,
    edges,
    observationPoints,
    observationPointsStatus: "ready",
    onRefreshObservationPoints: () => {},
    selectedNode: undefined,
    selectedEdge: undefined,
    onUpdateNode: () => {},
    onUpdateEdge: () => {},
    onReverseEdge: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof PropertiesPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoSelection: Story = {};

export const NodeSelected: Story = {
  args: {
    // ブースA（GOAL）を選択した状態
    selectedNode: nodes.find((n) => n.id === "ph_booth"),
  },
};

export const NodeWithObservationPoints: Story = {
  args: {
    // 観測点を紐づけ済みのノード（1つは接続中、1つは現在オフライン）
    selectedNode: {
      ...nodes.find((n) => n.id === "ph_booth"),
      data: {
        label: "ブースA",
        nodeType: "GOAL",
        observationPointIds: ["demo_event_cam-booth-a", "demo_event_cam-old"],
      },
    } as (typeof nodes)[number],
  },
};

export const EdgeSelected: Story = {
  args: {
    // junction → booth（両通行）を選択した状態
    selectedEdge: edges.find((e) => e.id === "ph_e2"),
  },
};

export const NoObservationPoints: Story = {
  args: {
    selectedNode: nodes.find((n) => n.id === "ph_booth"),
    observationPoints: [],
  },
};
