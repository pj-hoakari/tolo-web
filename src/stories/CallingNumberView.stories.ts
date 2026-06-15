import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CallingNumberView } from "@/features/guest/info/CallingNumberView";

const meta = {
  title: "Guest/Info/CallingNumber",
  component: CallingNumberView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    callingNumber: { control: { type: "number", min: 0 } },
  },
} satisfies Meta<typeof CallingNumberView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    callingNumber: 12,
  },
};

export const Empty: Story = {
  args: {
    callingNumber: 0,
  },
};
