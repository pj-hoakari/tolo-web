import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import {
  buildNodeTypeOptions,
  NodeProperties,
} from "@/features/tenant/management/graphEditor/components/properties";
import {
  DUAL_BOUNDARY_EDGES,
  DUAL_BOUNDARY_NODES,
  dualBoundaryNode,
  GRAPH_EDGES,
  GRAPH_NODES,
  graphNode,
  observationPointsSource,
  PanelFrame,
} from "./_helpers/propertiesFixtures";

const boothTypeOptions = buildNodeTypeOptions(
  "ph_booth",
  "GOAL",
  GRAPH_NODES,
  GRAPH_EDGES,
);

const meta = {
  title: "Tenant/Management/GraphEditor/Properties/NodeProperties",
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
    observationPoints: observationPointsSource({ onRefresh: fn() }),
    onChange: fn(),
  },
} satisfies Meta<typeof NodeProperties>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ブースA（目的地）を選択した状態 */
export const Default: Story = {};

/** 入退出点を選択した状態 */
export const Boundary: Story = {
  args: {
    node: graphNode("ph_entrance"),
    typeOptions: buildNodeTypeOptions(
      "ph_entrance",
      "BOUNDARY",
      GRAPH_NODES,
      GRAPH_EDGES,
    ),
  },
};

/** 観測点を紐づけ済み（1つは接続中、1つは現在オフライン） */
export const WithObservationPoints: Story = {
  args: {
    node: {
      ...graphNode("ph_booth"),
      data: {
        label: "ブースA",
        nodeType: "GOAL",
        observationPointIds: ["demo_event_cam-booth-a", "demo_event_cam-old"],
      },
    },
    observationPoints: observationPointsSource({
      usedIds: new Set(["demo_event_cam-booth-a", "demo_event_cam-old"]),
      onRefresh: fn(),
    }),
  },
};

/** 入退出の両方を担う入退出点。タイプ欄に info の通知が出る */
export const WithNotice: Story = {
  args: {
    node: dualBoundaryNode(),
    typeOptions: buildNodeTypeOptions(
      "gate",
      "BOUNDARY",
      DUAL_BOUNDARY_NODES,
      DUAL_BOUNDARY_EDGES,
    ),
  },
};

/** 制約違反で変更できないタイプがある状態（理由が並ぶ） */
export const WithDisabledType: Story = {
  args: {
    typeOptions: boothTypeOptions.map((option) =>
      option.type === "BOUNDARY"
        ? {
            ...option,
            assignable: false,
            disabledReason: "両通行のルートに接続しているため変更できません",
          }
        : option,
    ),
  },
};

/** 接続中の観測点が無い状態 */
export const NoObservationPoints: Story = {
  args: {
    observationPoints: observationPointsSource({
      available: [],
      onRefresh: fn(),
    }),
  },
};
