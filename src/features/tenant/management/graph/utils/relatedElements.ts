import type {
  EdgeDirection,
  GraphCanvasNode,
  GraphData,
  GraphEdgeType,
  GraphNodeType,
  GroupNodeType,
} from "../type";
import { isGroupNode } from "../type";

export type GraphElementKind = "node" | "group" | "edge";

export type GraphElementEntry = {
  kind: GraphElementKind;
  id: string;
  label: string;
};

export type EdgeRelations = {
  kind: "edge";
  source: GraphElementEntry;
  target: GraphElementEntry;
};

export type NodeRelations = {
  kind: "node";
  parent: GraphElementEntry | undefined;
  routes: GraphElementEntry[];
};

export type GroupRelations = {
  kind: "group";
  parent: GraphElementEntry | undefined;
  children: GraphElementEntry[];
};

export type RelatedElements = EdgeRelations | NodeRelations | GroupRelations;

export function edgeDirectionGlyph(direction: EdgeDirection): string {
  return direction === "both" ? "⇌" : "→";
}

export function nodeEntry(node: GraphCanvasNode): GraphElementEntry {
  return {
    kind: isGroupNode(node) ? "group" : "node",
    id: node.id,
    label: node.data.label ?? node.id,
  };
}

function nodeEntryById(
  nodes: GraphCanvasNode[],
  id: string,
): GraphElementEntry {
  const node = nodes.find((n) => n.id === id);
  return node ? nodeEntry(node) : { kind: "node", id, label: id };
}

export function edgeEntry(
  edge: GraphEdgeType,
  nodes: GraphCanvasNode[],
): GraphElementEntry {
  const source = nodeEntryById(nodes, edge.source).label;
  const target = nodeEntryById(nodes, edge.target).label;
  const glyph = edgeDirectionGlyph(edge.data?.direction ?? "both");
  return { kind: "edge", id: edge.id, label: `${source} ${glyph} ${target}` };
}

export function relatedElementsOf(
  graph: GraphData,
  selected: GraphEdgeType,
): EdgeRelations;
export function relatedElementsOf(
  graph: GraphData,
  selected: GroupNodeType,
): GroupRelations;
export function relatedElementsOf(
  graph: GraphData,
  selected: GraphNodeType,
): NodeRelations;
export function relatedElementsOf(
  { nodes, edges }: GraphData,
  selected: GraphCanvasNode | GraphEdgeType,
): RelatedElements {
  if ("source" in selected) {
    return {
      kind: "edge",
      source: nodeEntryById(nodes, selected.source),
      target: nodeEntryById(nodes, selected.target),
    };
  }
  const parent = selected.parentId
    ? nodeEntryById(nodes, selected.parentId)
    : undefined;
  if (isGroupNode(selected)) {
    return {
      kind: "group",
      parent,
      children: nodes.filter((n) => n.parentId === selected.id).map(nodeEntry),
    };
  }
  return {
    kind: "node",
    parent,
    routes: edges
      .filter((e) => e.source === selected.id || e.target === selected.id)
      .map((e) => edgeEntry(e, nodes)),
  };
}
