import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { ObservationLinkPanel } from "@/features/tenant/management/graphEditor/components/observation";
import {
  GRAPH_EDGES,
  GRAPH_NODES,
  graphEdge,
  graphNode,
  observationPointsSource,
} from "./_helpers/propertiesFixtures";

const meta = {
  title: "Tenant/Management/GraphEditor/Observation/ObservationLinkPanel",
  component: ObservationLinkPanel,
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
    observationPoints: observationPointsSource({ onRefresh: fn() }),
    selectedNode: undefined,
    selectedEdge: undefined,
    onLinkNode: fn(),
    onLinkEdge: fn(),
  },
} satisfies Meta<typeof ObservationLinkPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 何も選択していない状態 */
export const NoSelection: Story = {};

/** ポイント（ブースA）を選択した状態 */
export const NodeSelected: Story = {
  args: {
    selectedNode: graphNode("ph_booth"),
  },
};

/** 観測点を紐づけ済みのポイント（1つは接続中、1つは現在オフライン） */
export const NodeWithObservationPoints: Story = {
  args: {
    selectedNode: {
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

/** ルート（エントランスホール ⇌ ブースA）を選択した状態 */
export const EdgeSelected: Story = {
  args: {
    selectedEdge: graphEdge("ph_e2"),
  },
};

/** 他のポイント / ルートで使用中の観測点は選択できない */
export const ObservationPointUsedElsewhere: Story = {
  args: {
    selectedNode: graphNode("ph_booth"),
    observationPoints: observationPointsSource({
      usedIds: new Set(["demo_event_cam-hall"]),
      onRefresh: fn(),
    }),
  },
};

/** 接続中の観測点が無い状態 */
export const NoObservationPoints: Story = {
  args: {
    selectedNode: graphNode("ph_booth"),
    observationPoints: observationPointsSource({
      available: [],
      onRefresh: fn(),
    }),
  },
};

/** 観測点をチェックすると、選択中ポイントの ID とともに通知される */
export const LinkNode: Story = {
  args: {
    selectedNode: graphNode("ph_booth"),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole("checkbox", { name: /demo_event_cam-booth-a/ }),
    );

    await expect(args.onLinkNode).toHaveBeenCalledWith("ph_booth", [
      "demo_event_cam-booth-a",
    ]);
  },
};
