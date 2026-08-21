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
    labelCounts: { ja: 12, en: 3 },
    pointCount: 12,
  },
} satisfies Meta<typeof GraphEditorToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 英語ラベルを編集中の状態 */
export const EditingEnglishLabels: Story = {
  args: { labelLocale: "en" },
};
