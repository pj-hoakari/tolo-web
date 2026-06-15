import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  type GuideMapRoom,
  GuideMapView,
  type GuideMapWaypoint,
  type MapPoint,
} from "@/features/guest/info/GuideMapView";

const rooms: GuideMapRoom[] = [
  { id: "hall", label: "ホール", x: 20, y: 20, width: 150, height: 90 },
  { id: "goods", label: "グッズ売り場", x: 190, y: 20, width: 110, height: 70 },
  { id: "cafe", label: "カフェ", x: 190, y: 110, width: 110, height: 70 },
  { id: "exit", label: "出口", x: 20, y: 160, width: 90, height: 50 },
];

const waypoints: GuideMapWaypoint[] = [
  { id: "ev", label: "EV", point: { x: 160, y: 150 } },
];

const start: MapPoint = { x: 160, y: 224 };

const destinations = [
  { id: "hall", name: "ホール" },
  { id: "goods", name: "グッズ売り場" },
  { id: "cafe", name: "カフェ" },
  { id: "exit", name: "出口" },
];

const cafeRoute: MapPoint[] = [
  start,
  { x: 160, y: 150 },
  { x: 245, y: 150 },
  { x: 245, y: 110 },
];

const meta = {
  title: "Guest/Info/GuideMap",
  component: GuideMapView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    width: 320,
    height: 240,
    rooms,
    waypoints,
    start,
    destinations,
    onSelectDestination: () => {},
  },
} satisfies Meta<typeof GuideMapView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Selected: Story = {
  args: {
    selectedDestinationId: "cafe",
    route: cafeRoute,
  },
};

export const Unselected: Story = {
  args: {
    selectedDestinationId: null,
    route: [],
  },
};
