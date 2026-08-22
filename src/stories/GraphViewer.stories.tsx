import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { GraphViewer } from "@/features/tenant/management/graph";
import { graphEditPath } from "@/features/tenant/management/routes";
import { SAMPLE_EVENT_ID, SAMPLE_TENANT_ID } from "@/mocks/fixtures/edges";
import { mswBeforeEach } from "@/mocks/storybook";

const meta = {
  title: "Tenant/Management/Graph/GraphViewer",
  component: GraphViewer,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  // 観測点一覧（/rpc の edges.listAlive）を MSW で返す
  beforeEach: mswBeforeEach,
  decorators: [
    (Story) => (
      <div style={{ display: "flex", height: 520 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    tenantId: SAMPLE_TENANT_ID,
    eventId: SAMPLE_EVENT_ID,
    editHref: graphEditPath(SAMPLE_EVENT_ID),
  },
} satisfies Meta<typeof GraphViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** プレースホルダのグラフを表示専用で開いた状態 */
export const Default: Story = {};

/** 編集ページへの導線を持たない呼び出し */
export const WithoutEditAction: Story = {
  args: { editHref: undefined },
};
