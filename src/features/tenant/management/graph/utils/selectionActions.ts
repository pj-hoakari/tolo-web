import type { Messages } from "next-intl";
import type { GraphCanvasNode, GraphData, GroupNodeType } from "../type";
import { isExternalNode, isGroupNode } from "../type";
import { keepLastExternal } from "./graphMutations";
import {
  dissolveGroups,
  fitGroupsToChildren,
  reparentNode,
  sortByNesting,
} from "./groups";

type GroupSelectionError =
  keyof Messages["Graph"]["properties"]["groupSelectionErrors"];

/** 矢印は判定に含めず、同じ所属の通常ポイントだけをグループ化する。 */
export function getGroupSelectionError(
  nodes: GraphCanvasNode[],
): GroupSelectionError | null {
  const selected = nodes.filter((node) => node.selected);
  if (selected.some((node) => isGroupNode(node) || isExternalNode(node)))
    return "pointsOnly";
  if (selected.length < 2) return "tooFewPoints";
  if (selected.some((node) => node.parentId !== selected[0].parentId))
    return "differentParents";
  return null;
}

function selectedElementsToDelete(graph: GraphData) {
  return keepLastExternal(
    {
      nodes: graph.nodes.filter((node) => node.selected),
      edges: graph.edges.filter((edge) => edge.selected),
    },
    graph.nodes,
  );
}

export function canDeleteSelectedElements(graph: GraphData): boolean {
  const deleting = selectedElementsToDelete(graph);
  return deleting.nodes.length > 0 || deleting.edges.length > 0;
}

/** グループは解除し、明示的に選択したポイントと矢印だけを削除する。 */
export function deleteSelectedElements(graph: GraphData): GraphData {
  const deleting = selectedElementsToDelete(graph);
  if (deleting.nodes.length === 0 && deleting.edges.length === 0) return graph;
  const deletedNodes = new Set(deleting.nodes.map((node) => node.id));
  const deletedEdges = new Set(deleting.edges.map((edge) => edge.id));
  const dissolved = dissolveGroups(
    graph.nodes,
    deleting.nodes.filter(isGroupNode).map((node) => node.id),
  );
  return {
    nodes: fitGroupsToChildren(
      dissolved.filter((node) => !deletedNodes.has(node.id)),
    ),
    edges: graph.edges.filter(
      (edge) =>
        !deletedEdges.has(edge.id) &&
        !deletedNodes.has(edge.source) &&
        !deletedNodes.has(edge.target),
    ),
  };
}

/** 対象ポイントの位置を保ち、新しいグループだけを選択する。 */
export function groupSelectedPoints(
  graph: GraphData,
  group: GroupNodeType,
): GraphData {
  if (
    getGroupSelectionError(graph.nodes) !== null ||
    graph.nodes.some((node) => node.id === group.id)
  )
    return graph;
  const selected = graph.nodes.filter((node) => node.selected);
  // parentId は自動判定しない。最上位同士の場合も明示的に最上位へ置く。
  const parentId = selected[0].parentId;
  let nodes = sortByNesting([...graph.nodes, { ...group, parentId }]);
  for (const node of selected) nodes = reparentNode(nodes, node.id, group.id);
  return {
    nodes: fitGroupsToChildren(nodes).map((node) => ({
      ...node,
      selected: node.id === group.id,
    })),
    edges: graph.edges.map((edge) =>
      edge.selected ? { ...edge, selected: false } : edge,
    ),
  };
}
