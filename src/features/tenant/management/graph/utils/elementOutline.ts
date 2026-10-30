import type { GraphData } from "../type";
import {
  edgeEntry,
  type GraphElementEntry,
  nodeEntry,
} from "./relatedElements";

export type OutlineItem = GraphElementEntry & { children: OutlineItem[] };

export type OutlineTree = {
  elements: OutlineItem[];
  routes: GraphElementEntry[];
};

export function elementOutline({ nodes, edges }: GraphData): OutlineTree {
  const ids = new Set(nodes.map((node) => node.id));
  const childrenOf = (parentId: string | undefined): OutlineItem[] =>
    nodes
      .filter((node) =>
        parentId === undefined
          ? node.parentId === undefined || !ids.has(node.parentId)
          : node.parentId === parentId,
      )
      .map((node) => ({ ...nodeEntry(node), children: childrenOf(node.id) }));
  return {
    elements: childrenOf(undefined),
    routes: edges.map((edge) => edgeEntry(edge, nodes)),
  };
}
