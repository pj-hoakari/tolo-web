import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { EdgeReverseButton } from "@/features/tenant/management/graphEditor/components/properties";
import { PanelFrame } from "./_helpers/propertiesFixtures";

const meta = {
  title: "Tenant/Management/GraphEditor/Properties/EdgeReverseButton",
  component: EdgeReverseButton,
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
    isDisabled: false,
    reason: null,
    onPress: fn(),
  },
} satisfies Meta<typeof EdgeReverseButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 片方向ルートで反転できる状態 */
export const Enabled: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: /向きを反転/ }));

    await expect(args.onPress).toHaveBeenCalledOnce();
  },
};

/** 両通行ルートは向きの概念が無いため反転できない（理由は出さない） */
export const DisabledForBoth: Story = {
  args: { isDisabled: true },
};

/** 反転すると制約違反になるため無効化し、理由を出す */
export const DisabledWithReason: Story = {
  args: {
    isDisabled: true,
    reason: "反転すると入退出点の向きが成立しません",
  },
};
