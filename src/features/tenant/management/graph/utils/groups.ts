import type { XYPosition } from "@xyflow/react";
import { type GraphCanvasNode, type GroupNodeType, isGroupNode } from "../type";

/** 新規グループの初期サイズ */
export const GROUP_DEFAULT_WIDTH = 480;
export const GROUP_DEFAULT_HEIGHT = 320;

/** リサイズ時の最小サイズ（ラベルと最低1ノード分を確保） */
export const GROUP_MIN_WIDTH = 200;
export const GROUP_MIN_HEIGHT = 120;

/** 寸法未計測時に用いる想定サイズ */
function sizeOf(node: GraphCanvasNode): { width: number; height: number } {
  const fallback = isGroupNode(node)
    ? { width: GROUP_DEFAULT_WIDTH, height: GROUP_DEFAULT_HEIGHT }
    : { width: 160, height: 56 };
  return {
    width: node.measured?.width ?? node.width ?? fallback.width,
    height: node.measured?.height ?? node.height ?? fallback.height,
  };
}

/**
 * 親相対の position を絶対座標に変換する。
 * 親が見つからない・循環しているときは辿れた分までで打ち切る。
 */
export function absolutePositionOf(
  node: GraphCanvasNode,
  nodeById: ReadonlyMap<string, GraphCanvasNode>,
): XYPosition {
  let x = node.position.x;
  let y = node.position.y;
  const visited = new Set([node.id]);
  let parentId = node.parentId;
  while (parentId && !visited.has(parentId)) {
    const parent = nodeById.get(parentId);
    if (!parent) break;
    visited.add(parent.id);
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }
  return { x, y };
}

/**
 * 幾何計算（接続辺の決定・近傍判定）用に、全ノードの position を
 * 絶対座標へ置き換えた配列を返す。グラフの状態としては使わないこと。
 */
export function withAbsolutePositions<T extends GraphCanvasNode>(
  nodes: T[],
): T[] {
  const byId = new Map<string, GraphCanvasNode>(nodes.map((n) => [n.id, n]));
  return nodes.map((n) =>
    n.parentId ? { ...n, position: absolutePositionOf(n, byId) } : n,
  );
}

/** 指定ノード配下（子孫）の ID 集合 */
export function descendantIdsOf(
  nodes: GraphCanvasNode[],
  rootId: string,
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    const list = childrenByParent.get(n.parentId);
    if (list) list.push(n.id);
    else childrenByParent.set(n.parentId, [n.id]);
  }
  const result = new Set<string>();
  const queue = [...(childrenByParent.get(rootId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined || result.has(id)) continue;
    result.add(id);
    queue.push(...(childrenByParent.get(id) ?? []));
  }
  return result;
}

/**
 * React Flow の「親ノードは子より先」という並び順制約を満たすように
 * ネストの浅い順へ安定ソートする。
 */
export function sortByNesting(nodes: GraphCanvasNode[]): GraphCanvasNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depthOf = (node: GraphCanvasNode): number => {
    let depth = 0;
    const visited = new Set([node.id]);
    let parentId = node.parentId;
    while (parentId && !visited.has(parentId)) {
      const parent = byId.get(parentId);
      if (!parent) break;
      visited.add(parent.id);
      depth += 1;
      parentId = parent.parentId;
    }
    return depth;
  };
  return nodes
    .map((node, index) => ({ node, index, depth: depthOf(node) }))
    .sort((a, b) => a.depth - b.depth || a.index - b.index)
    .map((entry) => entry.node);
}

/**
 * ノードの中心を含む最も内側（最小面積）のグループを返す。
 * 自分自身とその子孫は候補にしない（グループを自分の中に入れない）。
 * どのグループにも含まれないときは undefined（トップレベル）。
 */
export function resolveParentGroup(
  nodeId: string,
  nodes: GraphCanvasNode[],
): string | undefined {
  const byId = new Map<string, GraphCanvasNode>(nodes.map((n) => [n.id, n]));
  const node = byId.get(nodeId);
  if (!node) return undefined;

  const excluded = descendantIdsOf(nodes, nodeId);
  excluded.add(nodeId);

  const abs = absolutePositionOf(node, byId);
  const size = sizeOf(node);
  const center = { x: abs.x + size.width / 2, y: abs.y + size.height / 2 };

  let best: GroupNodeType | undefined;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const candidate of nodes) {
    if (!isGroupNode(candidate) || excluded.has(candidate.id)) continue;
    const candidateAbs = absolutePositionOf(candidate, byId);
    const { width, height } = sizeOf(candidate);
    const contains =
      center.x >= candidateAbs.x &&
      center.x <= candidateAbs.x + width &&
      center.y >= candidateAbs.y &&
      center.y <= candidateAbs.y + height;
    if (!contains) continue;
    const area = width * height;
    if (area < bestArea) {
      best = candidate;
      bestArea = area;
    }
  }
  return best?.id;
}

/**
 * 所属グループを付け替え、見た目の位置を変えないように
 * position を新しい親からの相対へ変換する。
 */
export function reparentNode(
  nodes: GraphCanvasNode[],
  id: string,
  parentId: string | undefined,
): GraphCanvasNode[] {
  const byId = new Map<string, GraphCanvasNode>(nodes.map((n) => [n.id, n]));
  const node = byId.get(id);
  if (!node || node.parentId === parentId) return nodes;

  const abs = absolutePositionOf(node, byId);
  const anchor = parentId ? byId.get(parentId) : undefined;
  const base = anchor ? absolutePositionOf(anchor, byId) : { x: 0, y: 0 };
  const updated: GraphCanvasNode = {
    ...node,
    parentId,
    position: { x: abs.x - base.x, y: abs.y - base.y },
  };
  return sortByNesting(nodes.map((n) => (n.id === id ? updated : n)));
}

/**
 * グループコンテナを取り除き、直下の子を「残存する最も近い祖先」へ
 * 付け替える（見た目の位置は維持）。中身は削除しない。
 */
export function dissolveGroups(
  nodes: GraphCanvasNode[],
  ids: string[],
): GraphCanvasNode[] {
  if (ids.length === 0) return nodes;
  const removing = new Set(ids);
  const byId = new Map<string, GraphCanvasNode>(nodes.map((n) => [n.id, n]));

  const remaining = nodes
    .filter((n) => !removing.has(n.id))
    .map((n) => {
      if (!n.parentId || !removing.has(n.parentId)) return n;
      let ancestorId: string | undefined = byId.get(n.parentId)?.parentId;
      while (ancestorId && removing.has(ancestorId)) {
        ancestorId = byId.get(ancestorId)?.parentId;
      }
      const anchor = ancestorId ? byId.get(ancestorId) : undefined;
      const abs = absolutePositionOf(n, byId);
      const base = anchor ? absolutePositionOf(anchor, byId) : { x: 0, y: 0 };
      return {
        ...n,
        parentId: anchor?.id,
        position: { x: abs.x - base.x, y: abs.y - base.y },
      };
    });
  return sortByNesting(remaining);
}
