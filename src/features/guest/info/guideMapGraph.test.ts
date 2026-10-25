import { describe, expect, it } from "vitest";
import type { GraphData } from "@/features/tenant/management/graph/type";
import { toGuestGuideMapGraph } from "./guideMapGraph";

const graph: GraphData = {
  nodes: [
    {
      id: "g-1f",
      type: "graphGroup",
      position: { x: 0, y: 0 },
      width: 400,
      height: 300,
      data: { labels: { ja: "1F" } },
    },
    {
      id: "p-hall",
      type: "graph",
      parentId: "g-1f",
      position: { x: 40, y: 60 },
      data: {
        labels: { ja: "ホール", en: "Hall" },
        nodeType: "GOAL",
        observationPointIds: ["op-1"],
      },
    },
    {
      id: "p-corridor",
      type: "graph",
      parentId: "g-1f",
      position: { x: 200, y: 60 },
      data: { labels: { ja: "廊下" }, nodeType: "TRANSIT_ONLY" },
    },
    {
      id: "external",
      type: "graph",
      position: { x: 600, y: 60 },
      data: { labels: {}, nodeType: "EXTERNAL" },
    },
  ],
  edges: [
    {
      id: "r-hall-corridor",
      type: "graph",
      source: "p-hall",
      target: "p-corridor",
      data: {
        direction: "oneway",
        label: "正面通路",
        observationPointIds: ["op-2"],
      },
    },
    {
      id: "r-corridor-external",
      type: "graph",
      source: "p-corridor",
      target: "external",
      data: { direction: "both" },
    },
  ],
};

describe("toGuestGuideMapGraph", () => {
  it("ポイントは ID・ラベル・種別だけを渡し、位置・グループ・観測点は渡さない", () => {
    expect(toGuestGuideMapGraph(graph).points).toEqual([
      {
        pointId: "p-hall",
        labels: { ja: "ホール", en: "Hall" },
        nodeType: "GOAL",
      },
      {
        pointId: "p-corridor",
        labels: { ja: "廊下" },
        nodeType: "TRANSIT_ONLY",
      },
    ]);
  });

  it("ルートは端点・方向・ラベルだけを渡し、会場の外のポイントにつながるルートは渡さない", () => {
    expect(toGuestGuideMapGraph(graph).routes).toEqual([
      {
        routeId: "r-hall-corridor",
        source: "p-hall",
        target: "p-corridor",
        direction: "oneway",
        label: "正面通路",
      },
    ]);
  });
});
