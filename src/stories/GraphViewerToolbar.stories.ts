import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { GraphViewerToolbar } from "@/features/tenant/management/graph/components/GraphViewerToolbar";
import { graphEditPath } from "@/features/tenant/management/routes";
import { SAMPLE_EVENT_ID } from "@/mocks/fixtures/edges";

const meta = {
  title: "Tenant/Management/Graph/GraphViewerToolbar",
  component: GraphViewerToolbar,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  args: {
    editHref: graphEditPath(SAMPLE_EVENT_ID),
    onSave: fn(),
  },
} satisfies Meta<typeof GraphViewerToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 編集ページへの導線を出さない呼び出し */
export const WithoutEditAction: Story = {
  args: { editHref: undefined },
};
