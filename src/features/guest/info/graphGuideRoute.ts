/**
 * 会場グラフの通路（エッジ）をたどって、現在地→目的地の経路を求める。
 * 座標ベースの経路探索ではなく、グラフの接続そのものを最短ホップで探索する。
 */

import type { GuideEdge } from "./graphGuideModel";

/** 隣接リスト（有向）。both は双方向、oneway は from→to のみ張る */
export function buildAdjacency(edges: GuideEdge[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  const link = (from: string, to: string) => {
    const list = adjacency.get(from);
    if (list) list.push(to);
    else adjacency.set(from, [to]);
  };
  for (const edge of edges) {
    link(edge.from, edge.to);
    if (edge.direction === "both") link(edge.to, edge.from);
  }
  return adjacency;
}

/**
 * start から goal への最短経路（ノード ID の順序リスト）を返す。
 * 到達できない場合は空配列。start === goal のときは [start]。
 * 通行方向（direction）を尊重して探索する。
 */
export function findPath(
  edges: GuideEdge[],
  start: string,
  goal: string,
): string[] {
  if (start === goal) return [start];

  const adjacency = buildAdjacency(edges);
  const previous = new Map<string, string>();
  const visited = new Set<string>([start]);
  const queue: string[] = [start];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (current === goal) break;
    for (const next of adjacency.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      previous.set(next, current);
      queue.push(next);
    }
  }

  if (!visited.has(goal)) return [];

  // goal から previous をたどって start まで戻し、反転して返す
  const path: string[] = [goal];
  let node = goal;
  while (node !== start) {
    const prev = previous.get(node);
    if (prev === undefined) return [];
    path.push(prev);
    node = prev;
  }
  return path.reverse();
}

/**
 * 経路（ノード ID 列）に含まれる隣接ペアを "a\tb"（両向き）で集合化する。
 * 描画側でエッジが経路上かどうかを O(1) で判定するために使う。
 */
export function routeSegmentKeys(routeIds: string[]): Set<string> {
  const keys = new Set<string>();
  for (let i = 1; i < routeIds.length; i++) {
    const a = routeIds[i - 1];
    const b = routeIds[i];
    keys.add(`${a}\t${b}`);
    keys.add(`${b}\t${a}`);
  }
  return keys;
}
