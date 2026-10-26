import { describe, expect, it } from "vitest";
import {
  layoutFixture,
  layoutFixtureNames,
  layoutSearchSeeds,
} from "@/mocks/fixtures/graphLayout";
import type { GraphData } from "../../type";
import { ensureExternalNode } from "../graphMutations";
import { fitGroupsToChildren } from "../groups";
import { autoAlignGraph } from "./index";

const cases = [
  ...new Set([
    ...layoutFixtureNames,
    ...layoutSearchSeeds.map((s) => `issue249-seed-${s}`),
  ]),
];
const geometry = (graph: GraphData) =>
  graph.nodes.map((n) => ({
    id: n.id,
    position: n.position,
    width: n.width,
    height: n.height,
  }));

describe("auto alignment preserves manual layout without saved layout state", () => {
  for (const name of cases) {
    it(`${name}: first alignment remains unchanged through ten alignments`, () => {
      const input = layoutFixture(name);
      if (!input) throw new Error(name);
      let graph = autoAlignGraph(
        fitGroupsToChildren(ensureExternalNode(input.nodes)),
        input.edges,
      );
      const first = geometry(graph);
      const saved = graph.nodes.map((n) => ({
        id: n.id,
        parentId: n.parentId,
        data: n.data,
      }));
      for (let i = 1; i < 10; i++) {
        // Reload the saved shape with no measured dimensions or runtime identity.
        graph = JSON.parse(JSON.stringify(graph)) as GraphData;
        graph.nodes = graph.nodes.map(({ measured: _measured, ...n }) => n);
        graph = autoAlignGraph(graph.nodes, graph.edges);
        expect(geometry(graph)).toEqual(first);
        expect(
          graph.nodes.map((n) => ({
            id: n.id,
            parentId: n.parentId,
            data: n.data,
          })),
        ).toEqual(saved);
      }
    });
  }

  it("does not use stale group measurements on the next alignment", () => {
    const graph = layoutFixture("issue249-group-movement");
    if (!graph) throw new Error("fixture");
    const input = fitGroupsToChildren(graph.nodes).map((n) =>
      n.type === "graphGroup"
        ? { ...n, measured: { width: n.width ?? 480, height: n.height ?? 320 } }
        : n,
    );
    const once = autoAlignGraph(input, graph.edges);
    expect(geometry(autoAlignGraph(once.nodes, once.edges))).toEqual(
      geometry(once),
    );
  });

  it("realigns after a manual move, label size change, or route change", () => {
    const nodes: GraphData["nodes"] = [0, 1, 2].map((i) => ({
      id: `n${i}`,
      type: "graph",
      position: { x: i * 300, y: 0 },
      data: { labels: { ja: `point ${i}` }, nodeType: "GOAL_TRANSIT_MIXED" },
    }));
    const edges: GraphData["edges"] = [0, 1].map((i) => ({
      id: `e${i}`,
      source: `n${i}`,
      target: `n${i + 1}`,
      type: "graph",
      data: { direction: "both" },
    }));
    const first = autoAlignGraph(nodes, edges);
    const moved = first.nodes.map((n) =>
      n.id === "n1"
        ? { ...n, position: { ...n.position, y: n.position.y + 100 } }
        : n,
    );
    expect(geometry(autoAlignGraph(moved, first.edges))).toEqual(
      geometry(first),
    );
    const resized = first.nodes.map((n) =>
      n.id === "n1" ? { ...n, measured: { width: 400, height: 100 } } : n,
    );
    const withLabel = autoAlignGraph(resized, first.edges);
    expect(geometry(withLabel)).not.toEqual(geometry(first));
    expect(geometry(autoAlignGraph(withLabel.nodes, withLabel.edges))).toEqual(
      geometry(withLabel),
    );
    const withRoute = autoAlignGraph(first.nodes, [
      ...first.edges,
      {
        id: "skip",
        source: "n0",
        target: "n2",
        type: "graph",
        data: { direction: "both" },
      },
    ]);
    expect(geometry(withRoute)).not.toEqual(geometry(first));
    expect(geometry(autoAlignGraph(withRoute.nodes, withRoute.edges))).toEqual(
      geometry(withRoute),
    );
  });
});

it("recognizes deep nested groups and still repairs a moved descendant", () => {
  const graph: GraphData = { nodes: [], edges: [] };
  for (let i = 0; i < 10; i++)
    graph.nodes.push({
      id: `g${i}`,
      type: "graphGroup",
      ...(i ? { parentId: `g${i - 1}` } : {}),
      position: { x: 50, y: 50 },
      width: 480,
      height: 320,
      data: { labels: { ja: `group ${i}` } },
    });
  for (let i = 0; i < 3; i++)
    graph.nodes.push({
      id: `p${i}`,
      type: "graph",
      parentId: "g9",
      position: { x: 100 + i * 250, y: 100 },
      data: { labels: { ja: `point ${i}` }, nodeType: "GOAL_TRANSIT_MIXED" },
    });
  graph.edges = [0, 1].map((i) => ({
    id: `e${i}`,
    source: `p${i}`,
    target: `p${i + 1}`,
    type: "graph",
    data: { direction: "both" },
  }));
  const first = autoAlignGraph(fitGroupsToChildren(graph.nodes), graph.edges);
  expect(geometry(autoAlignGraph(first.nodes, first.edges))).toEqual(
    geometry(first),
  );
  const moved = first.nodes.map((n) =>
    n.id === "p1"
      ? { ...n, position: { ...n.position, y: n.position.y + 100 } }
      : n,
  );
  expect(geometry(autoAlignGraph(moved, first.edges))).toEqual(geometry(first));
});
