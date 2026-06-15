import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FloorView } from "@/features/guest/info/FloorView";

const meta = {
  title: "Guest/Info/Floor",
  component: FloorView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    floorName: "1F",
  },
} satisfies Meta<typeof FloorView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Basement: Story = {
  args: {
    floorName: "B1",
  },
};
