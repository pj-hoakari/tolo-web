import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CongestionView } from "@/features/guest/info/CongestionView";

const meta = {
  title: "Guest/Info/Congestion",
  component: CongestionView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    areas: [
      {
        id: "elevator-1f",
        name: "1F エレベーター前",
        level: "high",
        danger: true,
      },
      { id: "hall-6f", name: "6F ホール", level: "mid", danger: false },
      { id: "corridor-4f", name: "4F 廊下", level: "low", danger: false },
      { id: "lounge-4f", name: "4F ラウンジ", level: "high", danger: false },
    ],
    updatedAt: "14:28 更新",
  },
} satisfies Meta<typeof CongestionView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllCalm: Story = {
  args: {
    areas: [
      {
        id: "elevator-1f",
        name: "1F エレベーター前",
        level: "low",
        danger: false,
      },
      { id: "hall-6f", name: "6F ホール", level: "low", danger: false },
      { id: "corridor-4f", name: "4F 廊下", level: "low", danger: false },
    ],
  },
};

export const Empty: Story = {
  args: {
    areas: [],
    updatedAt: undefined,
    message: "混雑の情報はまだありません",
  },
};

export const LoadError: Story = {
  args: {
    areas: [],
    updatedAt: undefined,
    message: "情報を取得できませんでした",
  },
};
