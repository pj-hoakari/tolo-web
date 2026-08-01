import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PropertyNotice } from "@/features/tenant/management/graph/components/properties";
import { PanelFrame } from "./_helpers/propertiesFixtures";

const meta = {
  title: "Tenant/Management/Graph/Properties/PropertyNotice",
  component: PropertyNotice,
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
    level: {
      control: { type: "inline-radio" },
      options: ["warning", "info"],
    },
    message: { control: { type: "text" } },
  },
  args: {
    message: "この操作は現在の接続状況では選択できません",
  },
} satisfies Meta<typeof PropertyNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定は warning（制約違反の理由） */
export const Warning: Story = {};

/** info（制約違反ではないが強調したい状態） */
export const Info: Story = {
  args: {
    level: "info",
    message: "入退出（入力・出力）の両方を担っています",
  },
};

/** パネル幅で折り返す長文 */
export const LongMessage: Story = {
  args: {
    message:
      "接続中のルートの向きと矛盾するため、このタイプへは変更できません。先にルートの方向を変更してください。",
  },
};
