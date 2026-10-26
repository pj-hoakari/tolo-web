import { afterEach, describe, expect, it, vi } from "vitest";
import type { GraphData } from "../../type";
import { autoAlignGraph } from "./index";
import * as planning from "./planning";

afterEach(() => vi.restoreAllMocks());

function nestedVerticalGraph(depth: number): GraphData {
  const graph: GraphData = { nodes: [], edges: [] };
  for (let i = 0; i < depth; i++) {
    graph.nodes.push({
      id: `g${i}`,
      type: "graphGroup",
      ...(i ? { parentId: `g${i - 1}` } : {}),
      position: { x: 300, y: 0 },
      width: 480,
      height: 320,
      data: { labels: { ja: `group ${i}` } },
    });
  }
  // Every level needs its own vertical flow: a chain of groups alone matches
  // the first orientation and never exposes repeated successful searches.
  for (let i = 0; i <= depth; i++) {
    for (let j = 0; j < 2; j++) {
      graph.nodes.push({
        id: `p${i}_${j}`,
        type: "graph",
        ...(i ? { parentId: `g${i - 1}` } : {}),
        position: { x: 0, y: j * 1000 },
        data: { labels: { ja: `point ${j}` }, nodeType: "GOAL_TRANSIT_MIXED" },
      });
    }
    graph.edges.push({
      id: `e${i}`,
      source: `p${i}_0`,
      target: `p${i}_1`,
      type: "graph",
      data: { direction: "both" },
    });
  }
  return graph;
}

describe("aligned layout matching", () => {
  it.each([false, true])(
    "bounds searches on successful vertical groups (reversed: %s)",
    (reversed) => {
      const depth = 6;
      const graph = nestedVerticalGraph(depth);
      if (reversed) {
        for (const node of graph.nodes) {
          if (node.type === "graph") node.position.y = 1000 - node.position.y;
        }
      }
      const first = autoAlignGraph(graph.nodes, graph.edges);
      const plan = vi.spyOn(planning, "planContainer");

      expect(autoAlignGraph(first.nodes, first.edges)).toEqual(first);
      // No routes leave these subtrees, so each container has only one search
      // context. Count work instead of timing it to keep this stable on CI.
      expect(plan.mock.calls.length).toBeLessThanOrEqual(8 * (depth + 1));
    },
  );

  it("rechecks previously matched descendants after a manual move", () => {
    const graph = nestedVerticalGraph(10);
    const first = autoAlignGraph(graph.nodes, graph.edges);
    expect(autoAlignGraph(first.nodes, first.edges)).toEqual(first);

    const moved = first.nodes.map((node) =>
      node.id === "p10_1"
        ? { ...node, position: { ...node.position, x: node.position.x + 100 } }
        : node,
    );
    expect(autoAlignGraph(moved, first.edges)).toEqual(first);
  });
});
