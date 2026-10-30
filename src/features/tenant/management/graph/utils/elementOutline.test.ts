import { describe, expect, it } from "vitest";
import type { GraphEdgeType, GraphNodeType, GroupNodeType } from "../type";
import { elementOutline } from "./elementOutline";

const group = (
  id: string,
  label: string,
  parentId?: string,
): GroupNodeType => ({
  id,
  type: "graphGroup",
  position: { x: 0, y: 0 },
  parentId,
  data: { labels: { ja: label }, label },
});
const point = (
  id: string,
  label: string,
  parentId?: string,
): GraphNodeType => ({
  id,
  type: "graph",
  position: { x: 0, y: 0 },
  parentId,
  data: { labels: { ja: label }, label, nodeType: "TRANSIT_ONLY" },
});
const outside: GraphNodeType = {
  id: "outside",
  type: "graph",
  position: { x: 0, y: 0 },
  data: { labels: {}, label: "外部", nodeType: "EXTERNAL" },
};
const exit: GraphEdgeType = {
  id: "e1",
  type: "graph",
  source: "hall",
  target: "outside",
  data: { direction: "oneway" },
};

describe("elementOutline", () => {
  it("nests points and groups under their group and keeps top-level points and routes apart", () => {
    expect(
      elementOutline({
        nodes: [
          group("floor", "1F"),
          group("wing", "東棟", "floor"),
          point("hall", "ホール", "floor"),
          point("booth", "ブース", "wing"),
          outside,
        ],
        edges: [exit],
      }),
    ).toEqual({
      elements: [
        {
          kind: "group",
          id: "floor",
          label: "1F",
          children: [
            {
              kind: "group",
              id: "wing",
              label: "東棟",
              children: [
                { kind: "node", id: "booth", label: "ブース", children: [] },
              ],
            },
            { kind: "node", id: "hall", label: "ホール", children: [] },
          ],
        },
        { kind: "node", id: "outside", label: "外部", children: [] },
      ],
      routes: [{ kind: "edge", id: "e1", label: "ホール → 外部" }],
    });
  });

  it("puts an element whose parent is missing at the top level", () => {
    expect(
      elementOutline({ nodes: [point("hall", "ホール", "gone")], edges: [] })
        .elements,
    ).toEqual([{ kind: "node", id: "hall", label: "ホール", children: [] }]);
  });

  it("is empty for an empty graph", () => {
    expect(elementOutline({ nodes: [], edges: [] })).toEqual({
      elements: [],
      routes: [],
    });
  });
});
