import { describe, expect, it } from "vitest";
import type {
  EdgeDirection,
  GraphData,
  GraphEdgeType,
  GraphNodeType,
  GroupNodeType,
} from "../type";
import { relatedElementsOf } from "./relatedElements";

function point(id: string, label: string, parentId?: string): GraphNodeType {
  return {
    id,
    type: "graph",
    position: { x: 0, y: 0 },
    ...(parentId ? { parentId } : {}),
    data: { labels: { ja: label }, label, nodeType: "GOAL_TRANSIT_MIXED" },
  };
}

function group(id: string, label: string, parentId?: string): GroupNodeType {
  return {
    id,
    type: "graphGroup",
    position: { x: 0, y: 0 },
    ...(parentId ? { parentId } : {}),
    data: { labels: { ja: label }, label },
  };
}

function route(
  id: string,
  source: string,
  target: string,
  direction: EdgeDirection,
): GraphEdgeType {
  return { id, type: "graph", source, target, data: { direction } };
}

const building = group("building", "本館");
const floor = group("floor", "1F", "building");
const hall = point("hall", "ホール", "floor");
const booth = point("booth", "ブース", "floor");
const lobby = point("lobby", "ロビー", "building");
const outside = point("outside", "屋外");
const hallToBooth = route("e1", "hall", "booth", "both");
const boothToOutside = route("e2", "booth", "outside", "oneway");
const lobbyToHall = route("e3", "lobby", "hall", "oneway");

const graph: GraphData = {
  nodes: [building, floor, hall, booth, lobby, outside],
  edges: [hallToBooth, boothToOutside, lobbyToHall],
};

describe("relatedElementsOf", () => {
  it("returns the source and target points of a route", () => {
    expect(relatedElementsOf(graph, boothToOutside)).toEqual({
      kind: "edge",
      source: { kind: "node", id: "booth", label: "ブース" },
      target: { kind: "node", id: "outside", label: "屋外" },
    });
  });

  it("falls back to the id when an endpoint has no display label", () => {
    const unlabeled: GraphNodeType = {
      ...outside,
      data: { labels: {}, nodeType: "EXTERNAL" },
    };
    expect(
      relatedElementsOf(
        { nodes: [booth, unlabeled], edges: [boothToOutside] },
        boothToOutside,
      ).target,
    ).toEqual({ kind: "node", id: "outside", label: "outside" });
  });

  it("returns the routes connected to a point in either direction and its parent group", () => {
    expect(relatedElementsOf(graph, booth)).toEqual({
      kind: "node",
      parent: { kind: "group", id: "floor", label: "1F" },
      routes: [
        { kind: "edge", id: "e1", label: "ホール ⇌ ブース" },
        { kind: "edge", id: "e2", label: "ブース → 屋外" },
      ],
    });
  });

  it("returns no parent for a top-level point", () => {
    expect(relatedElementsOf(graph, outside)).toEqual({
      kind: "node",
      parent: undefined,
      routes: [{ kind: "edge", id: "e2", label: "ブース → 屋外" }],
    });
  });

  it("returns the direct children of a group, including nested groups, and its parent group", () => {
    expect(relatedElementsOf(graph, building)).toEqual({
      kind: "group",
      parent: undefined,
      children: [
        { kind: "group", id: "floor", label: "1F" },
        { kind: "node", id: "lobby", label: "ロビー" },
      ],
    });
    expect(relatedElementsOf(graph, floor)).toEqual({
      kind: "group",
      parent: { kind: "group", id: "building", label: "本館" },
      children: [
        { kind: "node", id: "hall", label: "ホール" },
        { kind: "node", id: "booth", label: "ブース" },
      ],
    });
  });
});
