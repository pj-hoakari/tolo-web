import { describe, expect, it } from "vitest";
import type { GraphEdgeType, GraphNodeType } from "../type";
import { collectObservationPointIds } from "./observationPoints";

function node(id: string, observationPointIds?: string[]): GraphNodeType {
  return {
    id,
    type: "graph",
    position: { x: 0, y: 0 },
    data: { labels: { ja: id }, nodeType: "GOAL", observationPointIds },
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  observationPointIds?: string[],
): GraphEdgeType {
  return {
    id,
    source,
    target,
    type: "graph",
    data: { direction: "both", observationPointIds },
  };
}

describe("collectObservationPointIds", () => {
  it("ノードとルートの紐づけをすべて集める", () => {
    const nodes = [node("n1", ["cam-1"]), node("n2"), node("n3", ["cam-3"])];
    const edges = [edge("e1", "n1", "n2", ["cam-e1"]), edge("e2", "n2", "n3")];

    expect(collectObservationPointIds(nodes, edges)).toEqual(
      new Set(["cam-1", "cam-3", "cam-e1"]),
    );
  });

  it("同じ観測点が複数の要素に紐づいていても1つに畳む", () => {
    const nodes = [node("n1", ["cam-1"]), node("n2", ["cam-1"])];

    expect(collectObservationPointIds(nodes, [])).toEqual(new Set(["cam-1"]));
  });

  it("紐づけが無ければ空", () => {
    expect(collectObservationPointIds([node("n1")], [])).toEqual(new Set());
  });
});
