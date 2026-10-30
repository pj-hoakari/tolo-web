import { describe, expect, it } from "vitest";
import type { GraphEdgeType, GraphNodeType } from "../../type";
import { sidePanelView } from "./sidePanelView";

const point: GraphNodeType = {
  id: "booth",
  type: "graph",
  position: { x: 0, y: 0 },
  data: { labels: { ja: "ブース" }, nodeType: "GOAL" },
};
const route: GraphEdgeType = {
  id: "e1",
  type: "graph",
  source: "hall",
  target: "booth",
  data: { direction: "both" },
};

describe("sidePanelView", () => {
  it("shows the outline when nothing is selected", () => {
    expect(
      sidePanelView({
        selectedNode: undefined,
        selectedEdge: undefined,
        selectionCounts: { nodes: 0, edges: 0, groups: 0 },
      }),
    ).toEqual({ kind: "outline" });
  });

  it("shows the properties of the single selected point or route", () => {
    expect(
      sidePanelView({
        selectedNode: point,
        selectedEdge: undefined,
        selectionCounts: { nodes: 1, edges: 0, groups: 0 },
      }),
    ).toEqual({ kind: "node", node: point });
    expect(
      sidePanelView({
        selectedNode: undefined,
        selectedEdge: route,
        selectionCounts: { nodes: 0, edges: 1, groups: 0 },
      }),
    ).toEqual({ kind: "edge", edge: route });
  });

  it("shows bulk editing when more than one element is selected", () => {
    const counts = { nodes: 1, edges: 0, groups: 1 };
    expect(
      sidePanelView({
        selectedNode: undefined,
        selectedEdge: undefined,
        selectionCounts: counts,
      }),
    ).toEqual({ kind: "bulk", counts });
  });
});
