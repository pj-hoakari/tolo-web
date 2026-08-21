import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type {
  GraphNodeType,
  NodeType,
} from "@/features/tenant/management/graph/type";
import { StoryGraphCanvas } from "./_helpers/StoryGraphCanvas";

// 単一ノードを最小 ReactFlow キャンバスに載せて表示
type SingleNodeArgs = {
  nodeType: NodeType;
  label: string;
  selected: boolean;
};

function SingleNode({ nodeType, label, selected }: SingleNodeArgs) {
  const node: GraphNodeType = {
    id: "node-1",
    type: "graph",
    position: { x: 0, y: 0 },
    // label は表示言語で解決済みの描画用フィールド（deriveNodeLabels が注入する形）
    data: { labels: { ja: label }, label, nodeType },
    selected,
  };
  return <StoryGraphCanvas nodes={[node]} edges={[]} height={240} />;
}

const meta = {
  title: "Tenant/Management/Graph/GraphNode",
  component: SingleNode,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
    nodeType: {
      control: { type: "select" },
      options: [
        "GOAL",
        "GOAL_TRANSIT_MIXED",
        "TRANSIT_ONLY",
        "BOUNDARY",
      ] satisfies NodeType[],
    },
    label: { control: { type: "text" } },
    selected: { control: { type: "boolean" } },
  },
  args: {
    label: "ブースA",
    selected: false,
  },
} satisfies Meta<typeof SingleNode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Goal: Story = {
  args: { nodeType: "GOAL", label: "ブースA" },
};

export const GoalTransitMixed: Story = {
  args: { nodeType: "GOAL_TRANSIT_MIXED", label: "壁展示" },
};

export const TransitOnly: Story = {
  args: { nodeType: "TRANSIT_ONLY", label: "エントランスホール" },
};

export const Boundary: Story = {
  args: { nodeType: "BOUNDARY", label: "入口" },
};

export const Selected: Story = {
  args: { nodeType: "GOAL", label: "ブースA", selected: true },
};
