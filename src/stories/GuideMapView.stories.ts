import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { GuideMapView } from "@/features/guest/info/GuideMapView";
import { computeFloorRoute } from "@/features/guest/info/venueFloorRoute";
import type { VenueMapDoc } from "@/features/guest/info/venueMapDoc";
import venueMapFixture from "@/features/guest/info/venueMapFixture.json";

// guide-map-poc の会場マップ・スタジオが書き出す形式の固定見本（イベント会場 1F・2F）。
// 表示用の venueMapData.json は差し替わるので、Story はこちらで状態を固定する
const doc = venueMapFixture as unknown as VenueMapDoc;
const [f1, f2] = doc.floors;
const onFloor = (floorId: string) =>
  doc.objects.filter((o) => o.floor === floorId);

// 1F の入場ゲート → 1F のカフェ
const sameFloor = computeFloorRoute(doc, "p-gate", "r-cafe");
// 1F の入場ゲート → 2F のホール（階段かエレベーターを経由）
const otherFloor = computeFloorRoute(doc, "p-gate", "r2-hall");

const walkOn = (
  result: ReturnType<typeof computeFloorRoute>,
  floorId: string,
) =>
  "steps" in result
    ? result.steps.flatMap((s) =>
        s.kind === "walk" && s.floor === floorId ? [s.points] : [],
      )
    : [];

const meta = {
  title: "Guest/Info/GuideMap",
  component: GuideMapView,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    title: "案内マップ",
    floor: f1,
    objects: onFloor(f1.id),
    routes: [],
    markers: [{ objectId: "p-gate", label: "現在地" }],
  },
} satisfies Meta<typeof GuideMapView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unselected: Story = {};

export const RouteOnSameFloor: Story = {
  args: {
    routes: walkOn(sameFloor, f1.id),
    activeId: "r-cafe",
    markers: [
      { objectId: "p-gate", label: "現在地" },
      { objectId: "r-cafe", label: "目的地" },
    ],
  },
};

/** 別の階の目的地。到着階（2F）側の表示 */
export const RouteArrivalFloor: Story = {
  args: {
    floor: f2,
    objects: onFloor(f2.id),
    routes: walkOn(otherFloor, f2.id),
    activeId: "r2-hall",
    markers: [{ objectId: "r2-hall", label: "目的地" }],
  },
};

export const Searching: Story = {
  args: {
    highlightIds: ["r-goods"],
  },
};
