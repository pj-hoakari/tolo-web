import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { QueuesView } from "@/features/guest/info/QueuesView";

const meta = {
  title: "Guest/Info/Queues",
  component: QueuesView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    queues: [
      {
        id: "q-hall-6f",
        name: "6F ホール",
        waitTime: "約13分",
        recommendedGates: "おすすめの入口: 階段",
      },
      {
        id: "q-lounge-4f",
        name: "4F ラウンジ",
        waitTime: "約3分",
        recommendedGates: "おすすめの入口: ラウンジ入口、エレベーター",
      },
      { id: "q-office-3f", name: "3F 職員室", waitTime: "約25分" },
    ],
  },
} satisfies Meta<typeof QueuesView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    queues: [],
    message: "待ち時間の情報はまだありません",
  },
};

export const Loading: Story = {
  args: {
    queues: [],
    message: "読み込み中…",
  },
};
