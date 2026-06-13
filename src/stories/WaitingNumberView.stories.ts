import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { WaitingNumberView } from "@/features/guest/info/WaitingNumberView";

const meta = {
  title: "Guest/Info/WaitingNumber",
  component: WaitingNumberView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    waitingNumber: { control: { type: "number", min: 0 } },
  },
} satisfies Meta<typeof WaitingNumberView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    waitingNumber: 5,
  },
};

export const Empty: Story = {
  args: {
    waitingNumber: 0,
  },
};

export const Crowded: Story = {
  args: {
    waitingNumber: 120,
  },
};
