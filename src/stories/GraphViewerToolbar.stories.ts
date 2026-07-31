import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { GraphViewerToolbar } from "@/features/tenant/management/graphEditor/components/GraphViewerToolbar";

const meta = {
  title: "Tenant/Management/GraphEditor/GraphViewerToolbar",
  component: GraphViewerToolbar,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  args: {
    onEditGraph: fn(),
    onSave: fn(),
  },
} satisfies Meta<typeof GraphViewerToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 編集ページへの導線を出さない呼び出し */
export const WithoutEditAction: Story = {
  args: { onEditGraph: undefined },
};
