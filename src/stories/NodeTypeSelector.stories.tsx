import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import {
  NodeTypeSelector,
  type NodeTypeSelectorProps,
} from "@/features/tenant/management/graph/components/properties";
import { NODE_TYPE_DEFS } from "@/features/tenant/management/graph/nodeTypes";
import type { NodeType } from "@/features/tenant/management/graph/type";
import { PanelFrame } from "./_helpers/propertiesFixtures";

/** すべてのタイプが選択可能な状態の選択肢 */
const allAssignable = NODE_TYPE_DEFS.map((def) => ({
  type: def.type,
  assignable: true,
  disabledReason: null,
}));

/** 選択状態を自分で保持して、実際の切り替えを確認できるようにするラッパー */
function StatefulNodeTypeSelector({
  value,
  onChange,
  ...props
}: NodeTypeSelectorProps) {
  const [nodeType, setNodeType] = useState<NodeType>(value);
  return (
    <NodeTypeSelector
      {...props}
      value={nodeType}
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
  argTypes: {
    value: {
      control: { type: "select" },
      options: NODE_TYPE_DEFS.map((def) => def.type),
    },
  },
  args: {
    value: "GOAL",
    options: allAssignable,
    onChange: fn(),
  },
} satisfies Meta<typeof NodeTypeSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 一部のタイプが制約違反で選択できず、その理由が並ぶ */
export const WithDisabledOptions: Story = {
  args: {
    value: "TRANSIT_ONLY",
    options: allAssignable.map((option) =>
      option.type === "BOUNDARY"
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
      canvas.getByRole("radio", { name: /入退出点/ }),
    ).toBeDisabled();
  },
};

/** 選択中のタイプに紐づく通知（info）を表示する */
export const WithNotices: Story = {
  args: {
    value: "BOUNDARY",
    notices: [
      { level: "info", message: "入退出（入力・出力）の両方を担っています" },
    ],
  },
};

/** クリックでタイプが切り替わり、onChange に選択値が渡る */
export const Interactive: Story = {
  render: (args) => <StatefulNodeTypeSelector {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("radio", { name: /通過のみ/ }));

    await expect(args.onChange).toHaveBeenCalledWith("TRANSIT_ONLY");
    await expect(
      canvas.getByRole("radio", { name: /通過のみ/ }),
    ).toHaveAttribute("aria-checked", "true");
  },
};
