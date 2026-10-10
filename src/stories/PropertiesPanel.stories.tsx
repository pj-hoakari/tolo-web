import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { PropertiesPanel } from "@/features/tenant/management/graph/components/properties";
import {
  BOUNDARY_EDGES,
  BOUNDARY_NODES,
  boundaryFixtureNode,
  GRAPH_EDGES,
  GRAPH_NODES,
  graphEdge,
  graphNode,
} from "./_helpers/propertiesFixtures";

const meta = {
  title: "Tenant/Management/Graph/PropertiesPanel",
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
    labelLocale: "ja",
    onUpdateNode: fn(),
    onSetNodeLabel: fn(),
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

export const Boundary: Story = {
  args: {
    // 外部ポイントと接続したポイントを選択 → タイプ欄に入退出点の通知が表示される
    graph: { nodes: BOUNDARY_NODES, edges: BOUNDARY_EDGES },
    selectedNode: boundaryFixtureNode("gate"),
  },
};

export const ExternalClosed: Story = {
  args: {
    graph: { nodes: BOUNDARY_NODES, edges: [] },
    selectedNode: boundaryFixtureNode("external", []),
  },
};
