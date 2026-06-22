import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CrowdDetectionControls } from "@/features/tenant/observation/components/CrowdDetectionControls";

const meta = {
  title: "Tenant/Observation/CrowdDetectionControls",
  component: CrowdDetectionControls,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: { type: "inline-radio" },
      options: ["idle", "loading", "detecting", "error"],
    },
  },
  args: {
    status: "idle",
    onStart: () => {},
    onStop: () => {},
  },
} satisfies Meta<typeof CrowdDetectionControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: { status: "idle" },
};

export const Loading: Story = {
  args: { status: "loading" },
};

export const Detecting: Story = {
  args: { status: "detecting" },
};
