import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ConnectedEdges } from "@/features/tenant/webrtc/components/ConnectedEdges";
import { SAMPLE_EVENT_ID, SAMPLE_TENANT_ID } from "@/mocks/fixtures/edges";
import { edgesErrorHandlers, edgesHandlers } from "@/mocks/handlers";

// connect クリック後の WebRTC はスコープ外
const meta = {
  title: "Tenant/WebRTC/ConnectedEdges",
  component: ConnectedEdges,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    tenantId: SAMPLE_TENANT_ID,
    eventId: SAMPLE_EVENT_ID,
  },
} satisfies Meta<typeof ConnectedEdges>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithEdges: Story = {};

export const Empty: Story = {
  parameters: {
    msw: { handlers: edgesHandlers([]) },
  },
};

export const ErrorState: Story = {
  parameters: {
    msw: { handlers: edgesErrorHandlers() },
  },
};
