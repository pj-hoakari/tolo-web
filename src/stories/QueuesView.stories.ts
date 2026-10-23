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
        id: "q-goods",
        name: "グッズ売り場",
        waitTime: "約13分",
        recommendedGates: "おすすめの入口: 西ゲート",
      },
      {
        id: "q-cafe",
        name: "カフェ",
        waitTime: "約3分",
        recommendedGates: "おすすめの入口: カフェ入口、南口",
      },
      { id: "q-hall", name: "ホール", waitTime: "約25分" },
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
