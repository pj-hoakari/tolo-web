import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StaffMessageBellView } from "@/features/guest/info/StaffMessageBellView";
import type { StaffMessage } from "@/features/guest/info/StaffMessageView";

const messages: StaffMessage[] = [
  {
    id: "msg-2",
    body: "東ゲート付近が大変混雑しています。お急ぎの方は西ゲートのご利用をおすすめします。",
    staffName: "山田 太郎",
    staffRole: "会場スタッフ",
    deliveredAt: "2026-06-15T14:30:00+09:00",
  },
  {
    id: "msg-1",
    body: "開演時刻が 15:00 から 15:30 に変更となりました。ご了承ください。",
    staffName: "佐藤 花子",
    staffRole: "運営責任者",
    deliveredAt: "2026-06-15T13:05:00+09:00",
  },
];

const meta = {
  title: "Guest/Info/StaffMessageBell",
  component: StaffMessageBellView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    messages,
    onToggle: () => {},
  },
} satisfies Meta<typeof StaffMessageBellView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 新着あり・パネルを閉じた状態（バッジ表示） */
export const WithBadge: Story = {
  args: {
    unreadCount: 2,
    isOpen: false,
  },
};

/** パネルを開いた状態（一覧表示） */
export const Open: Story = {
  args: {
    unreadCount: 0,
    isOpen: true,
  },
};

/** 新着なし・閉じた状態 */
export const NoUnread: Story = {
  args: {
    unreadCount: 0,
    isOpen: false,
  },
};
