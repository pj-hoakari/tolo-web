import { describe, expect, it } from "vitest";
import type { GraphData } from "@/features/tenant/management/graph/type";
import { toGuestGuideMapGraph } from "./guideMapGraph";

const graph: GraphData = {
  nodes: [
    {
      id: "g_1f000001",
      type: "graphGroup",
      position: { x: 0, y: 0 },
      width: 400,
      height: 300,
      data: { labels: { ja: "1F" } },
    },
    {
      id: "n_4a110001",
      type: "graph",
      parentId: "g_1f000001",
      position: { x: 40, y: 60 },
      data: {
        labels: { ja: "ホール", en: "Hall" },
        nodeType: "GOAL",
        observationPointIds: ["op-1"],
      },
    },
    {
      id: "n_c0001001",
      type: "graph",
      parentId: "g_1f000001",
      position: { x: 200, y: 60 },
      data: { labels: { ja: "廊下" }, nodeType: "TRANSIT_ONLY" },
    },
    {
      id: "n_e0000001",
      type: "graph",
      position: { x: 600, y: 60 },
      data: { labels: {}, nodeType: "EXTERNAL" },
    },
  ],
  edges: [
    {
      id: "e_4a11c001",
      type: "graph",
      source: "n_4a110001",
      target: "n_c0001001",
      data: {
        direction: "oneway",
        label: "正面通路",
        observationPointIds: ["op-2"],
      },
    },
    {
      id: "e_c001e001",
      type: "graph",
      source: "n_c0001001",
      target: "n_e0000001",
      data: { direction: "both" },
    },
  ],
};

describe("toGuestGuideMapGraph", () => {
  it("ポイントは ID・ラベル・種別だけを渡し、位置・グループ・観測点は渡さない", () => {
    expect(toGuestGuideMapGraph(graph).points).toEqual([
      {
        pointId: "n_4a110001",
        labels: { ja: "ホール", en: "Hall" },
        nodeType: "GOAL",
      },
      {
        pointId: "n_c0001001",
        labels: { ja: "廊下" },
        nodeType: "TRANSIT_ONLY",
      },
    ]);
  });

  it("ルートは端点・方向・ラベルだけを渡し、会場の外のポイントにつながるルートは渡さない", () => {
    expect(toGuestGuideMapGraph(graph).routes).toEqual([
      {
        routeId: "e_4a11c001",
        source: "n_4a110001",
        target: "n_c0001001",
        direction: "oneway",
        label: "正面通路",
      },
    ]);
  });
});
