import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type {
  EdgeDirection,
  GraphEdgeType,
  GraphNodeType,
} from "@/features/tenant/management/graph/type";
import { StoryGraphCanvas } from "./_helpers/StoryGraphCanvas";

// 2 ノード間に 1 本のエッジを張った最小 ReactFlow キャンバスで表示
type SingleEdgeArgs = {
  direction: EdgeDirection;
  selected: boolean;
};

const nodes: GraphNodeType[] = [
  {
    id: "a",
    type: "graph",
    position: { x: 0, y: 60 },
    data: { label: "ポイントA", nodeType: "TRANSIT_ONLY" },
  },
  {
    id: "b",
    type: "graph",
    position: { x: 320, y: 60 },
    data: { label: "ポイントB", nodeType: "TRANSIT_ONLY" },
  },
];

function SingleEdge({ direction, selected }: SingleEdgeArgs) {
  const edges: GraphEdgeType[] = [
    {
      id: "edge-1",
      source: "a",
      target: "b",
      type: "graph",
      data: { direction },
      selected,
    },
  ];
  return <StoryGraphCanvas nodes={nodes} edges={edges} height={240} />;
}

const meta = {
  title: "Tenant/Management/Graph/GraphEdge",
  component: SingleEdge,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
    direction: {
      control: { type: "inline-radio" },
      options: ["both", "oneway"] satisfies EdgeDirection[],
    },
    selected: { control: { type: "boolean" } },
  },
  args: {
    direction: "both",
    selected: false,
  },
} satisfies Meta<typeof SingleEdge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Both: Story = {
  args: { direction: "both" },
};

export const OneWay: Story = {
  args: { direction: "oneway" },
};

export const Selected: Story = {
  args: { direction: "both", selected: true },
};
