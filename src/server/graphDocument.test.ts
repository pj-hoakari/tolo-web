import { create } from "@bufbuild/protobuf";
import {
  EdgeDirection,
  GraphDocumentSchema,
  NodeType,
} from "@pj-hoakari/tolo-graph-authoring-client-es/tolo/graph/v1/graph_pb";
import { describe, expect, it } from "vitest";
import { PLACEHOLDER_GRAPH } from "@/features/graph/placeholderGraph";
import type { GraphData } from "@/features/tenant/management/graph/type";
import { fromGraphDocument, toGraphDocument } from "./graphDocument";

describe("graphDocument", () => {
  it("PLACEHOLDER_GRAPH を往復させても変わらない", () => {
    expect(fromGraphDocument(toGraphDocument(PLACEHOLDER_GRAPH))).toEqual(
      PLACEHOLDER_GRAPH,
    );
  });

  it("子が先に並んだ深い入れ子でも親グループを先に返し、ポイントはその後に並ぶ", () => {
    const document = create(GraphDocumentSchema, {
      nodes: [
        { nodeId: "p", nodeType: NodeType.GOAL, groupId: "c", layout: {} },
      ],
      groups: [
        { groupId: "c", parentGroupId: "b", layout: { width: 1, height: 1 } },
        { groupId: "b", parentGroupId: "a", layout: { width: 1, height: 1 } },
        { groupId: "a", layout: { width: 1, height: 1 } },
      ],
    });
    const { nodes } = fromGraphDocument(document);
    expect(nodes.map((n) => [n.id, n.parentId])).toEqual([
      ["a", undefined],
      ["b", "a"],
      ["c", "b"],
      ["p", "c"],
    ]);
  });

  it("列挙値と省略可能なフィールドを双方向に対応づける", () => {
    const graph: GraphData = {
      nodes: [
        {
          id: "g",
          type: "graphGroup",
          position: { x: 1, y: 2 },
          width: 300,
          height: 200,
          data: { labels: { ja: "階" }, minWidth: 250, minHeight: 150 },
        },
        {
          id: "p1",
          type: "graph",
          position: { x: 10, y: 20 },
          parentId: "g",
          data: {
            labels: { en: "Gate" },
            nodeType: "EXTERNAL",
            observationPointIds: ["0123456789abcdef"],
          },
        },
        {
          id: "p2",
          type: "graph",
          position: { x: 30, y: 40 },
          data: { labels: {}, nodeType: "GOAL_TRANSIT_MIXED" },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "p1",
          target: "p2",
          type: "graph",
          data: { direction: "oneway", label: "通路" },
        },
        {
          id: "e2",
          source: "p2",
          target: "p1",
          type: "graph",
          data: { direction: "both" },
        },
      ],
    };

    const document = toGraphDocument(graph);
    expect(document.groups[0]).toMatchObject({
      groupId: "g",
      parentGroupId: "",
      layout: { x: 1, y: 2, width: 300, height: 200 },
      minWidth: 250,
      minHeight: 150,
    });
    expect(document.nodes.map((n) => [n.nodeType, n.groupId])).toEqual([
      [NodeType.EXTERNAL, "g"],
      [NodeType.GOAL_TRANSIT_MIXED, ""],
    ]);
    expect(document.edges.map((e) => [e.direction, e.label])).toEqual([
      [EdgeDirection.ONE_WAY, "通路"],
      [EdgeDirection.BOTH_WAYS, undefined],
    ]);

    const roundTripped = fromGraphDocument(document);
    expect(roundTripped).toEqual({
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === "p1"
          ? { ...n, data: { labels: { en: "Gate" }, nodeType: "EXTERNAL" } }
          : n,
      ),
    });
    expect(roundTripped.edges[1].data).not.toHaveProperty("label");
    expect(roundTripped.nodes[2]).not.toHaveProperty("parentId");
  });
});
