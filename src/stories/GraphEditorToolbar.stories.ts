import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { GraphEditorToolbar } from "@/features/tenant/management/graph/components/GraphEditorToolbar";

const meta = {
  title: "Tenant/Management/Graph/GraphEditorToolbar",
  component: GraphEditorToolbar,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  args: {
    onAddNode: () => {},
    onAddGroup: () => {},
    onAutoAlign: () => {},
    onSave: () => {},
    labelLocale: "ja",
    onChangeLabelLocale: () => {},
    // ポイント 11 + グループ 2 を想定した設定状況（en は一部のみ設定済みの例）
    labelCounts: { ja: 13, en: 3 },
    labelTargetCount: 13,
  },
} satisfies Meta<typeof GraphEditorToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 英語ラベルを編集中の状態 */
export const EditingEnglishLabels: Story = {
  args: { labelLocale: "en" },
};
