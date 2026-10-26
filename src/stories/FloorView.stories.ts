import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FloorView } from "@/features/guest/info/FloorView";

const meta = {
  title: "Guest/Info/Floor",
  component: FloorView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    floorName: "1F",
  },
} satisfies Meta<typeof FloorView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Basement: Story = {
  args: {
    floorName: "B1",
  },
};

/** 案内マップに複数フロアがあるときは、ここで表示フロアを切り替えられる */
export const MultipleFloors: Story = {
  args: {
    floorName: "2F",
    floors: [
      { id: "f-1", name: "1F" },
      { id: "f-2", name: "2F" },
      { id: "f-3", name: "3F" },
    ],
    activeFloorId: "f-2",
    onSelectFloor: () => {},
  },
};
