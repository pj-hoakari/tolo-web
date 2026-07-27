import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SelectionHeader } from "@/features/tenant/management/components/properties";
import { PanelFrame } from "./_helpers/propertiesFixtures";

const meta = {
  title: "Tenant/Management/Properties/SelectionHeader",
  component: SelectionHeader,
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
    kind: {
      control: { type: "inline-radio" },
      options: ["node", "edge"],
    },
    id: { control: { type: "text" } },
  },
  args: {
    kind: "node",
    id: "ph_booth",
  },
} satisfies Meta<typeof SelectionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Node: Story = {};

export const Edge: Story = {
  args: { kind: "edge", id: "ph_e2" },
};

/** 自動生成 ID のように長い場合 */
export const LongId: Story = {
  args: { id: "node_01JX7ZC9K8QG5T2M4N6P8R0S1V" },
};
