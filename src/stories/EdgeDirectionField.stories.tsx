import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import {
  EdgeDirectionField,
  type EdgeDirectionFieldProps,
} from "@/features/tenant/management/graph/components/properties";
import type { EdgeDirection } from "@/features/tenant/management/graph/type";
import { PanelFrame } from "./_helpers/propertiesFixtures";

/** 選択状態を自分で保持して、実際の切り替えを確認できるようにするラッパー */
function StatefulEdgeDirectionField({
  value,
  onChange,
  ...props
}: EdgeDirectionFieldProps) {
  const [direction, setDirection] = useState<EdgeDirection>(value);
  return (
    <EdgeDirectionField
      {...props}
      value={direction}
      onChange={(next) => {
        setDirection(next);
        onChange(next);
      }}
    />
  );
}

const meta = {
  title: "Tenant/Management/Graph/Properties/EdgeDirectionField",
  component: EdgeDirectionField,
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
      control: { type: "inline-radio" },
      options: ["both", "oneway"],
    },
  },
  args: {
    value: "both",
    bothDisabled: false,
    onewayDisabled: false,
    reason: null,
    onChange: fn(),
  },
} satisfies Meta<typeof EdgeDirectionField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Both: Story = {};

export const Oneway: Story = {
  args: { value: "oneway" },
};

/** 片方向が制約違反のため選択できない状態 */
export const OnewayDisabled: Story = {
  args: {
    onewayDisabled: true,
    reason: "接続中のポイントのタイプでは片方向にできません",
  },
};

/** 選択中の方向が制約違反（＝理由は出すが操作は塞がない） */
export const SelectedButInvalid: Story = {
  args: {
    value: "both",
    reason: "接続中のポイントのタイプでは両通行にできません",
  },
};

/** クリックで方向が切り替わり、onChange に選択値が渡る */
export const Interactive: Story = {
  render: (args) => <StatefulEdgeDirectionField {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("radio", { name: /片方向/ }));

    await expect(args.onChange).toHaveBeenCalledWith("oneway");
    await expect(canvas.getByRole("radio", { name: /片方向/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  },
};
