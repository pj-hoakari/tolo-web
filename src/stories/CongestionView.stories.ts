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
      { id: "entrance", name: "入場ゲート", level: "high", danger: true },
      { id: "hall", name: "ホール", level: "mid", danger: false },
      { id: "cafe", name: "カフェ", level: "low", danger: false },
      { id: "goods", name: "グッズ売り場", level: "high", danger: false },
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
      { id: "entrance", name: "入場ゲート", level: "low", danger: false },
      { id: "hall", name: "ホール", level: "low", danger: false },
      { id: "cafe", name: "カフェ", level: "low", danger: false },
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
