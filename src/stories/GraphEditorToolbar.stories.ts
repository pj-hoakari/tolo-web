import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { GraphEditorToolbar } from "@/features/tenant/management/graphEditor/components/GraphEditorToolbar";

const meta = {
  title: "Tenant/Management/GraphEditor/GraphEditorToolbar",
  component: GraphEditorToolbar,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  args: {
    onAddNode: () => {},
    onSave: () => {},
  },
} satisfies Meta<typeof GraphEditorToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
