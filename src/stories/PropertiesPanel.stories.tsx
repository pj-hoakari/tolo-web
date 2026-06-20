import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PropertiesPanel } from "@/features/tenant/management/components/PropertiesPanel";
import { PLACEHOLDER_GRAPH } from "@/features/tenant/management/placeholderGraph";

const { nodes, edges } = PLACEHOLDER_GRAPH;

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

export const EdgeSelected: Story = {
  args: {
    // junction → booth（両通行）を選択した状態
    selectedEdge: edges.find((e) => e.id === "ph_e2"),
  },
};
