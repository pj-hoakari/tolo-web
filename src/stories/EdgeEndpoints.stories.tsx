import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EdgeEndpoints } from "@/features/tenant/management/components/properties";
import { PanelFrame } from "./_helpers/propertiesFixtures";

const meta = {
  title: "Tenant/Management/Properties/EdgeEndpoints",
  component: EdgeEndpoints,
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
    direction: {
      control: { type: "inline-radio" },
      options: ["both", "oneway"],
    },
  },
  args: {
    sourceLabel: "エントランスホール",
    targetLabel: "ブースA",
    direction: "both",
  },
} satisfies Meta<typeof EdgeEndpoints>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 両通行（⇌） */
export const Both: Story = {};

/** 片方向（→） */
export const Oneway: Story = {
  args: { direction: "oneway" },
};

/** ラベルが長い場合 */
export const LongLabels: Story = {
  args: {
    sourceLabel: "第2展示ホール北側エントランス",
    targetLabel: "特設ステージ前ブース",
  },
};
