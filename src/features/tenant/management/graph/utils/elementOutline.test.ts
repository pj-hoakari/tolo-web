import { describe, expect, it } from "vitest";
import type { GraphEdgeType, GraphNodeType, GroupNodeType } from "../type";
import { outlineSections } from "./elementOutline";

const floor: GroupNodeType = {
  id: "floor",
  type: "graphGroup",
  position: { x: 0, y: 0 },
  data: { labels: { ja: "1F" }, label: "1F" },
};
const hall: GraphNodeType = {
  id: "hall",
  type: "graph",
  position: { x: 0, y: 0 },
  parentId: "floor",
  data: { labels: { ja: "ホール" }, label: "ホール", nodeType: "TRANSIT_ONLY" },
};
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

describe("outlineSections", () => {
  it("lists groups, points including external ones, and routes in that order", () => {
    expect(
      outlineSections({ nodes: [hall, floor, outside], edges: [exit] }),
    ).toEqual([
      { id: "groups", entries: [{ kind: "group", id: "floor", label: "1F" }] },
      {
        id: "points",
        entries: [
          { kind: "node", id: "hall", label: "ホール" },
          { kind: "node", id: "outside", label: "外部" },
        ],
      },
      {
        id: "routes",
        entries: [{ kind: "edge", id: "e1", label: "ホール → 外部" }],
      },
    ]);
  });

  it("omits sections that have no elements", () => {
    expect(outlineSections({ nodes: [outside], edges: [] })).toEqual([
      {
        id: "points",
        entries: [{ kind: "node", id: "outside", label: "外部" }],
      },
    ]);
  });
});
