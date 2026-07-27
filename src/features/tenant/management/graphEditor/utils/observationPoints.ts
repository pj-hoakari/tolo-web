import type { GraphEdgeType, GraphNodeType } from "../type";

/**
 * ノード/ルートに紐づけ済みの観測点 ID をすべて集めた集合。
 * 「いずれかの要素で使用中」の判定はグラフから毎回導出するため、
 * 使用状況を別途状態として持たない。
 */
export function collectObservationPointIds(
  nodes: GraphNodeType[],
  edges: GraphEdgeType[],
): Set<string> {
  const ids = new Set<string>();
  for (const n of nodes) {
    for (const id of n.data.observationPointIds ?? []) ids.add(id);
  }
  for (const e of edges) {
    for (const id of e.data?.observationPointIds ?? []) ids.add(id);
  }
  return ids;
}
