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
      { id: "entrance", name: "入場ゲート", level: "high" },
      { id: "hall", name: "ホール", level: "mid" },
      { id: "cafe", name: "カフェ", level: "low" },
      { id: "goods", name: "グッズ売り場", level: "high" },
    ],
  },
} satisfies Meta<typeof CongestionView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllCalm: Story = {
  args: {
    areas: [
      { id: "entrance", name: "入場ゲート", level: "low" },
      { id: "hall", name: "ホール", level: "low" },
      { id: "cafe", name: "カフェ", level: "low" },
    ],
  },
};
