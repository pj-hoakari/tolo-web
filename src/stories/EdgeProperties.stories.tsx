import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import {
  EdgeProperties,
  resolveEdgeDirectionState,
} from "@/features/tenant/management/graphEditor/components/properties";
import {
  GRAPH_EDGES,
  GRAPH_NODES,
  graphEdge,
  PanelFrame,
} from "./_helpers/propertiesFixtures";

function directionStateOf(edgeId: string) {
  return resolveEdgeDirectionState(graphEdge(edgeId), GRAPH_NODES, GRAPH_EDGES);
}

const meta = {
  title: "Tenant/Management/GraphEditor/Properties/EdgeProperties",
  component: EdgeProperties,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <PanelFrame>
        <Story />
      </PanelFrame>
    ),
  ],
  args: {
    edge: graphEdge("ph_e2"),
    directionState: directionStateOf("ph_e2"),
    endpoints: {
      sourceLabel: "エントランスホール",
      targetLabel: "ブースA",
    },
    onChange: fn(),
    onReverse: fn(),
  },
} satisfies Meta<typeof EdgeProperties>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 両通行のルート（向きの反転はできない） */
export const Both: Story = {};

/** 片方向のルート（向きを反転できる） */
export const Oneway: Story = {
  args: {
    edge: graphEdge("ph_e1"),
    directionState: directionStateOf("ph_e1"),
    endpoints: {
      sourceLabel: "入口",
      targetLabel: "エントランスホール",
    },
  },
};

/** 片方向が制約違反で選択できず、反転もできない状態 */
export const DirectionRestricted: Story = {
  args: {
    directionState: {
      ...directionStateOf("ph_e2"),
      onewayDisabled: true,
      directionReason: "接続中のポイントのタイプでは片方向にできません",
    },
  },
};
