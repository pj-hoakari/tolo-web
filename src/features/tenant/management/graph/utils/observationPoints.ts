import type { FlowElementState } from "@/features/flowState/type";
import type { GraphCanvasNode, GraphEdgeType } from "../type";
import { isPointNode } from "../type";

/**
 * ノード/ルートに紐づけ済みの観測点 ID をすべて集めた集合。
 * 「いずれかの要素で使用中」の判定はグラフから毎回導出するため、
 * 使用状況を別途状態として持たない。
 */
export function collectObservationPointIds(
  nodes: GraphCanvasNode[],
  edges: GraphEdgeType[],
): Set<string> {
  const ids = new Set<string>();
  for (const n of nodes) {
    if (!isPointNode(n)) continue;
    for (const id of n.data.observationPointIds ?? []) ids.add(id);
  }
  for (const e of edges) {
    for (const id of e.data?.observationPointIds ?? []) ids.add(id);
  }
  return ids;
}

export function flowStatesByObservationPoint(
  nodes: GraphCanvasNode[],
  edges: GraphEdgeType[],
  states: readonly FlowElementState[],
): Map<string, FlowElementState> {
  const byTarget = new Map(states.map((s) => [s.targetKey, s]));
  const anchors = [
    ...nodes
      .filter(isPointNode)
      .map((n) => [`node:${n.id}`, n.data.observationPointIds] as const),
    ...edges.map((e) => [`edge:${e.id}`, e.data?.observationPointIds] as const),
  ];
  const result = new Map<string, FlowElementState>();
  for (const [targetKey, ids] of anchors) {
    const state = byTarget.get(targetKey);
    if (!state) continue;
    for (const id of ids ?? []) result.set(id, state);
  }
  return result;
}
