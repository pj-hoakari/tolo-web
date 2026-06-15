import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { QueueLayoutView } from "@/features/guest/info/QueueLayoutView";

const meta = {
  title: "Guest/Info/QueueLayout",
  component: QueueLayoutView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    shape: "zigzag",
    laneCount: 4,
    peoplePerLane: 5,
    direction: "ltr",
    entrance: "bottom",
    currentCount: 13,
  },
  argTypes: {
    shape: {
      control: { type: "select" },
      options: ["zigzag", "straight", "l-shape", "spiral"],
    },
    direction: {
      control: { type: "select" },
      options: ["ltr", "rtl", "ttb", "btt"],
    },
    entrance: {
      control: { type: "select" },
      options: ["top", "bottom", "left", "right"],
    },
    laneCount: { control: { type: "number", min: 1 } },
    peoplePerLane: { control: { type: "number", min: 1 } },
    currentCount: { control: { type: "number", min: 0 } },
  },
} satisfies Meta<typeof QueueLayoutView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Zigzag: Story = {};

export const Straight: Story = {
  args: {
    shape: "straight",
    laneCount: 2,
    peoplePerLane: 6,
    currentCount: 7,
  },
};

export const LShape: Story = {
  args: {
    shape: "l-shape",
    laneCount: 4,
    peoplePerLane: 6,
    currentCount: 5,
  },
};

export const Spiral: Story = {
  args: {
    shape: "spiral",
    laneCount: 5,
    peoplePerLane: 5,
    currentCount: 9,
  },
};

export const Empty: Story = {
  args: {
    currentCount: 0,
  },
};
