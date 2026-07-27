import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { GraphToolbar } from "@/features/tenant/management/graphEditor/components/GraphToolbar";

const meta = {
  title: "Tenant/Management/GraphEditor/GraphToolbar",
  component: GraphToolbar,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  args: {
    onAddNode: () => {},
    onSave: () => {},
  },
} satisfies Meta<typeof GraphToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
