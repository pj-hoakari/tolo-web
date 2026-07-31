import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { PropertiesPanel } from "@/features/tenant/management/graphEditor/components/properties";
import {
  DUAL_BOUNDARY_EDGES,
  DUAL_BOUNDARY_NODES,
  dualBoundaryNode,
  GRAPH_EDGES,
  GRAPH_NODES,
  graphEdge,
  graphNode,
} from "./_helpers/propertiesFixtures";

const meta = {
  title: "Tenant/Management/GraphEditor/PropertiesPanel",
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
    graph: { nodes: GRAPH_NODES, edges: GRAPH_EDGES },
    selectedNode: undefined,
    selectedEdge: undefined,
    onUpdateNode: fn(),
    onUpdateEdge: fn(),
    onReverseEdge: fn(),
    onDelete: fn(),
  },
} satisfies Meta<typeof PropertiesPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoSelection: Story = {};

export const NodeSelected: Story = {
  args: {
    // ブースA（GOAL）を選択した状態
    selectedNode: graphNode("ph_booth"),
  },
};

export const EdgeSelected: Story = {
  args: {
    // junction → booth（両通行）を選択した状態
    selectedEdge: graphEdge("ph_e2"),
  },
};

export const BoundaryDualDirection: Story = {
  args: {
    // 入退出の両方を担う入退出点を選択 → タイプ欄に info 通知が表示される
    graph: { nodes: DUAL_BOUNDARY_NODES, edges: DUAL_BOUNDARY_EDGES },
    selectedNode: dualBoundaryNode(),
  },
};
