import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import {
  buildNodeTypeOptions,
  NodeTypeSelector,
  type NodeTypeSelectorProps,
} from "@/features/tenant/management/graph/components/properties";
import type { NodeType } from "@/features/tenant/management/graph/type";
import {
  GRAPH_EDGES,
  GRAPH_NODES,
  PanelFrame,
  passThroughNotice,
} from "./_helpers/propertiesFixtures";

const optionsFor = (type: NodeType) =>
  buildNodeTypeOptions(
    "ph_booth",
    type,
    GRAPH_NODES,
    GRAPH_EDGES,
    passThroughNotice,
  );

/** 選択状態を自分で保持して、実際の切り替えを確認できるようにするラッパー */
function StatefulNodeTypeSelector({
  onChange,
  ...props
}: NodeTypeSelectorProps) {
  const [nodeType, setNodeType] = useState<NodeType>("GOAL_TRANSIT_MIXED");
  return (
    <NodeTypeSelector
      {...props}
      options={optionsFor(nodeType)}
      onChange={(next) => {
        setNodeType(next);
        onChange(next);
      }}
    />
  );
}

const meta = {
  title: "Tenant/Management/Graph/Properties/NodeTypeSelector",
  component: NodeTypeSelector,
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
    options: optionsFor("GOAL_TRANSIT_MIXED"),
    onChange: fn(),
  },
} satisfies Meta<typeof NodeTypeSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 通過のみ。目的地のフラグは停滞を許容するまで選べない */
export const TransitOnly: Story = {
  args: {
    options: optionsFor("TRANSIT_ONLY"),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("checkbox", { name: /^目的地として扱う/ }),
    ).toBeDisabled();
  },
};

export const Destination: Story = {
  args: {
    options: optionsFor("GOAL"),
  },
};

/** 制約違反で切り替えられないフラグがあり、その理由が並ぶ */
export const WithDisabledOptions: Story = {
  args: {
    options: optionsFor("GOAL_TRANSIT_MIXED").map((option) =>
      option.flag === "dwell"
        ? {
            ...option,
            assignable: false,
            disabledReason: "両通行のルートに接続しているため変更できません",
          }
        : option,
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("checkbox", { name: /^停滞を許容する/ }),
    ).toBeDisabled();
  },
};

/** 選択中のタイプに紐づく通知（info）を表示する */
export const WithNotices: Story = {
  args: {
    notices: [{ level: "info", messageKey: "boundary" }],
  },
};

/** 停滞を外すと通過のみになり、目的地のフラグが選べなくなる */
export const Interactive: Story = {
  render: (args) => <StatefulNodeTypeSelector {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole("checkbox", { name: /^停滞を許容する/ }),
    );

    await expect(args.onChange).toHaveBeenCalledWith("TRANSIT_ONLY");
    await expect(
      canvas.getByRole("checkbox", { name: /^停滞を許容する/ }),
    ).not.toBeChecked();
    await expect(
      canvas.getByRole("checkbox", { name: /^目的地として扱う/ }),
    ).toBeDisabled();
  },
};
