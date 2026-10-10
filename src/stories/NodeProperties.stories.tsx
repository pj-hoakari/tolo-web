import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import {
  buildNodeTypeOptions,
  NodeProperties,
} from "@/features/tenant/management/graph/components/properties";
import {
  BOUNDARY_EDGES,
  BOUNDARY_NODES,
  boundaryFixtureNode,
  GRAPH_EDGES,
  GRAPH_NODES,
  graphNode,
  PanelFrame,
  passThroughNotice,
} from "./_helpers/propertiesFixtures";

const boothTypeOptions = buildNodeTypeOptions(
  "ph_booth",
  "GOAL",
  GRAPH_NODES,
  GRAPH_EDGES,
  passThroughNotice,
);

const meta = {
  title: "Tenant/Management/Graph/Properties/NodeProperties",
  component: NodeProperties,
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
    node: graphNode("ph_booth"),
    typeOptions: boothTypeOptions,
    labelLocale: "ja",
    onChange: fn(),
    onChangeLabel: fn(),
  },
} satisfies Meta<typeof NodeProperties>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ブースA（目的地）を選択した状態 */
export const Default: Story = {};

/** 外部ポイントと接続した入退出点。タイプ欄に info の通知が出る */
export const Boundary: Story = {
  args: {
    node: boundaryFixtureNode("gate"),
    typeOptions: buildNodeTypeOptions(
      "gate",
      "TRANSIT_ONLY",
      BOUNDARY_NODES,
      BOUNDARY_EDGES,
      passThroughNotice,
    ),
  },
};

/** 制約違反で変更できないタイプがある状態（理由が並ぶ） */
export const WithDisabledType: Story = {
  args: {
    typeOptions: boothTypeOptions.map((option) =>
      option.type === "TRANSIT_ONLY"
        ? {
            ...option,
            assignable: false,
            disabledReason: "両通行のルートに接続しているため変更できません",
          }
        : option,
    ),
  },
};
