import { describe, expect, it } from "vitest";
import type { GraphData } from "@/features/tenant/management/graph/type";
import { toGuestGuideMapGraph } from "./guideMapGraph";
import type { GuideMapLayout } from "./guideMapLayout";

const graph: GraphData = {
  nodes: [
    {
      id: "g_1f000001",
      type: "graphGroup",
      position: { x: 0, y: 0 },
      width: 400,
      height: 300,
      data: { labels: { ja: "1F", en: "1F" }, minWidth: 400 },
    },
    {
      id: "g_2f000002",
      type: "graphGroup",
      position: { x: 0, y: 400 },
      width: 400,
      height: 300,
      data: { labels: { ja: "2F" } },
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

const layout: Pick<GuideMapLayout, "groups" | "objects"> = {
  groups: [{ groupId: "g_1f000001" }],
  objects: [
    {
      id: "p-hall",
      kind: "place",
      groupId: "g_1f000001",
      color: "indigo",
      shape: "pin",
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      pointId: "n_4a110001",
    },
    {
      id: "a-corridor",
      kind: "area",
      groupId: "g_1f000001",
      color: "slate",
      points: [],
      routeId: "e_4a11c001",
    },
  ],
};

describe("toGuestGuideMapGraph", () => {
  it("レイアウトが参照するポイントとグループだけを ID とラベルだけで渡し、ルートは渡さない", () => {
    expect(toGuestGuideMapGraph(graph, layout)).toStrictEqual({
      points: [{ pointId: "n_4a110001", labels: { ja: "ホール", en: "Hall" } }],
      groups: [{ groupId: "g_1f000001", labels: { ja: "1F", en: "1F" } }],
    });
  });

  it("レイアウトが外部ポイントを参照していても外部ポイントは渡さない", () => {
    const withExternal = {
      ...layout,
      objects: [
        ...layout.objects,
        { ...layout.objects[0], id: "p-outside", pointId: "n_e0000001" },
      ],
    };
    expect(
      toGuestGuideMapGraph(graph, withExternal).points.map((p) => p.pointId),
    ).toStrictEqual(["n_4a110001"]);
  });
});
