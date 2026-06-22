import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EstimatedWaitTimeView } from "@/features/guest/info/EstimatedWaitTimeView";

const meta = {
  title: "Guest/Info/EstimatedWaitTime",
  component: EstimatedWaitTimeView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    minutes: { control: { type: "number", min: 0 } },
  },
} satisfies Meta<typeof EstimatedWaitTimeView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    minutes: 15,
  },
};

export const Empty: Story = {
  args: {
    minutes: 0,
  },
};

export const Long: Story = {
  args: {
    minutes: 90,
  },
};
