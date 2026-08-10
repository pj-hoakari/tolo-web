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
  },
} satisfies Meta<typeof GraphEditorToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
