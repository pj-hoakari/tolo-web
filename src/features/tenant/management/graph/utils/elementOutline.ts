import type { GraphData } from "../type";
import {
  edgeEntry,
  type GraphElementEntry,
  nodeEntry,
} from "./relatedElements";

export type OutlineSection = {
  id: "groups" | "points" | "routes";
  entries: GraphElementEntry[];
};

export function outlineSections({ nodes, edges }: GraphData): OutlineSection[] {
  const nodeEntries = nodes.map(nodeEntry);
  const sections: OutlineSection[] = [
    { id: "groups", entries: nodeEntries.filter((e) => e.kind === "group") },
    { id: "points", entries: nodeEntries.filter((e) => e.kind === "node") },
    { id: "routes", entries: edges.map((e) => edgeEntry(e, nodes)) },
  ];
  return sections.filter((section) => section.entries.length > 0);
}
