import type { GraphCanvasNode, GraphEdgeType } from "../../type";

export type SelectionCounts = { nodes: number; edges: number; groups: number };

export type SidePanelSelection = {
  selectedNode: GraphCanvasNode | undefined;
  selectedEdge: GraphEdgeType | undefined;
  selectionCounts?: SelectionCounts;
};

export type SingleSelection =
  | { kind: "node"; node: GraphCanvasNode }
  | { kind: "edge"; edge: GraphEdgeType };

export type SelectionView =
  | SingleSelection
  | { kind: "bulk"; counts: SelectionCounts };

export type SidePanelView = { kind: "outline" } | SelectionView;

export function sidePanelView({
  selectedNode,
  selectedEdge,
  selectionCounts,
}: SidePanelSelection): SidePanelView {
  if (
    selectionCounts &&
    selectionCounts.nodes + selectionCounts.edges + selectionCounts.groups > 1
  ) {
    return { kind: "bulk", counts: selectionCounts };
  }
  if (selectedNode) return { kind: "node", node: selectedNode };
  if (selectedEdge) return { kind: "edge", edge: selectedEdge };
  return { kind: "outline" };
}
