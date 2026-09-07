import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PLACEHOLDER_GRAPH } from "@/features/graph";
import { GraphGuideView } from "@/features/guest/info/GraphGuideView";
import { buildGuideGraph } from "@/features/guest/info/graphGuideModel";
import { findPath } from "@/features/guest/info/graphGuideRoute";

// サンプルの会場グラフ（placeholderGraph）を案内モデルへ変換して使う
const model = buildGuideGraph(PLACEHOLDER_GRAPH, "ja");
const galleryRoute =
  model.start != null ? findPath(model.edges, model.start, "ph_gallery2f") : [];

const meta = {
  title: "Guest/Info/GraphGuide",
  component: GraphGuideView,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    model,
    onSelectGoal: () => {},
    hint: "目的地を選択すると経路が表示されます",
    currentLocationLabel: "現在地",
    destinationsLabel: "目的地",
  },
} satisfies Meta<typeof GraphGuideView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unselected: Story = {
  args: {
    selectedGoalId: null,
    routeIds: [],
  },
};

// 2F の展示室Bまで、階段・エレベーターを経由する経路を強調表示
export const RouteToGallery: Story = {
  args: {
    selectedGoalId: "ph_gallery2f",
    routeIds: galleryRoute,
  },
};
