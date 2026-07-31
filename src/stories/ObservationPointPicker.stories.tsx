import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { ObservationPointPicker } from "@/features/tenant/management/graphEditor/components/observation";
import { OBSERVATION_POINTS, PanelFrame } from "./_helpers/propertiesFixtures";

const meta = {
  title: "Tenant/Management/GraphEditor/Observation/ObservationPointPicker",
  component: ObservationPointPicker,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <PanelFrame>
        <Story />
      </PanelFrame>
    ),
  ],
  argTypes: {
    status: {
      control: { type: "inline-radio" },
      options: ["idle", "loading", "ready", "error"],
    },
  },
  args: {
    linkedIds: [],
    available: OBSERVATION_POINTS,
    status: "ready",
    usedIds: new Set<string>(),
    onRefresh: fn(),
    onChange: fn(),
  },
} satisfies Meta<typeof ObservationPointPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 接続中の観測点が並び、まだ何も紐づいていない状態 */
export const Default: Story = {};

/** 紐づけ済み。件数が見出しに出る */
export const Linked: Story = {
  args: {
    linkedIds: ["demo_event_cam-booth-a"],
    usedIds: new Set(["demo_event_cam-booth-a"]),
  },
};

/** 紐づけ済みだが接続が切れている観測点は末尾にオフラインとして残る */
export const WithOfflinePoint: Story = {
  args: {
    linkedIds: ["demo_event_cam-booth-a", "demo_event_cam-old"],
    usedIds: new Set(["demo_event_cam-booth-a", "demo_event_cam-old"]),
  },
};

/** 他のポイント / ルートで使用中の観測点は選択できない */
export const UsedElsewhere: Story = {
  args: {
    usedIds: new Set(["demo_event_cam-hall"]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("checkbox", { name: /demo_event_cam-hall/ }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole("checkbox", { name: /demo_event_cam-entrance/ }),
    ).toBeEnabled();
  },
};

export const Loading: Story = {
  args: { available: [], status: "loading" },
};

export const Empty: Story = {
  args: { available: [], status: "ready" },
};

/** 観測点の取得に失敗した状態 */
export const FetchError: Story = {
  args: { available: [], status: "error" },
};

/** 更新ボタンを持たない（再取得できない）呼び出し */
export const WithoutRefresh: Story = {
  args: { onRefresh: undefined },
};

/** チェックすると選択された ID が onChange に渡る */
export const Interactive: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole("checkbox", { name: /demo_event_cam-entrance/ }),
    );

    await expect(args.onChange).toHaveBeenCalledWith([
      "demo_event_cam-entrance",
    ]);
  },
};
