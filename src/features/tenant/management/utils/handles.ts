import type {
  GraphEdgeType,
  GraphNodeType,
  HandleSide,
  NodeHandles,
} from "../type";

const SIDES: HandleSide[] = ["top", "right", "bottom", "left"];

export function parseHandleId(
  id: string | null | undefined,
): { side: HandleSide; index: number } | null {
  if (!id) return null;
  const dash = id.indexOf("-");
  if (dash < 0) return null;
  const side = id.slice(0, dash) as HandleSide;
  if (!SIDES.includes(side)) return null;
  const index = Number.parseInt(id.slice(dash + 1), 10);
  if (Number.isNaN(index) || index < 0) return null;
  return { side, index };
}

export function makeHandleId(side: HandleSide, index: number): string {
  return `${side}-${index}`;
}

export function deriveNodeHandles(
  nodes: GraphNodeType[],
  edges: GraphEdgeType[],
): GraphNodeType[] {
  const usedByNode = new Map<string, Record<HandleSide, Set<number>>>();
  for (const n of nodes) {
    usedByNode.set(n.id, {
      top: new Set(),
      right: new Set(),
      bottom: new Set(),
      left: new Set(),
    });
  }

  for (const e of edges) {
    const src = parseHandleId(e.sourceHandle);
    if (src && usedByNode.has(e.source)) {
      usedByNode.get(e.source)?.[src.side].add(src.index);
    }
    const tgt = parseHandleId(e.targetHandle);
    if (tgt && usedByNode.has(e.target)) {
      usedByNode.get(e.target)?.[tgt.side].add(tgt.index);
    }
  }

  return nodes.map((n) => {
    const used = usedByNode.get(n.id);
    const handles: NodeHandles = { top: [], right: [], bottom: [], left: [] };
    for (const side of SIDES) {
      const usedSet = used?.[side] ?? new Set<number>();
      const maxUsed = usedSet.size > 0 ? Math.max(...usedSet) : -1;
      const total = maxUsed + 2; // 既使用 + 空き1
      for (let i = 0; i < total; i++) {
        handles[side].push({
          id: makeHandleId(side, i),
          side,
          index: i,
          used: usedSet.has(i),
          total,
        });
      }
    }
    return {
      ...n,
      data: { ...n.data, handles },
    };
  });
}

/**
 * 接続辺を決める角度（水平からの傾き, 0°=水平 / 90°=垂直）の閾値
 * - 0° 〜 HORIZONTAL_MAX_ANGLE      : 左右どうし（対向）
 * - VERTICAL_MIN_ANGLE 〜 90°       : 上下どうし（対向）
 * - その間（斜め）                     : 始点=左右 / 終点=上下 の非対称
 * HORIZONTAL_MAX_ANGLE を大きくするほど左右優先
 */
export const HORIZONTAL_MAX_ANGLE = 30;
export const VERTICAL_MIN_ANGLE = 40;

/** 寸法未計測時に用いるノードの想定サイズ */
const FALLBACK_NODE_WIDTH = 160;
const FALLBACK_NODE_HEIGHT = 56;

type Vec2 = { x: number; y: number };

function nodeCenter(node: GraphNodeType): Vec2 {
  const width = node.measured?.width ?? node.width ?? FALLBACK_NODE_WIDTH;
  const height = node.measured?.height ?? node.height ?? FALLBACK_NODE_HEIGHT;
  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2,
  };
}

/**
 * source→target の角度から、両端が接続する辺(side)を決定
 * 水平に近ければ左右どうし、垂直に近ければ上下どうし
 * 斜めなら始点を左右・終点を上下
 */
function sidesForEdge(
  source: Vec2,
  target: Vec2,
): { sourceSide: HandleSide; targetSide: HandleSide } {
  const dx = target.x - source.x;
  const dy = target.y - source.y;

  const angle = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;

  const horizontalSource: HandleSide = dx >= 0 ? "right" : "left";
  const horizontalTarget: HandleSide = dx >= 0 ? "left" : "right";
  const verticalSource: HandleSide = dy >= 0 ? "bottom" : "top";
  const verticalTarget: HandleSide = dy >= 0 ? "top" : "bottom";

  if (angle <= HORIZONTAL_MAX_ANGLE) {
    return { sourceSide: horizontalSource, targetSide: horizontalTarget };
  }
  if (angle >= VERTICAL_MIN_ANGLE) {
    return { sourceSide: verticalSource, targetSide: verticalTarget };
  }

  // 斜め: 始点は左右・終点は上下
  return { sourceSide: horizontalSource, targetSide: verticalTarget };
}

type Attach = {
  edgeId: string;
  role: "source" | "target";
  side: HandleSide;
  /** 同じ辺に複数つくときの並び順を決める相手ノード中心 */
  other: Vec2;
};

/**
 * 各エッジについて、接続ノード間の位置関係から接続辺(上下左右)を選び、
 * 同じ辺に複数つく場合は相手ノードの位置順にスロット index を割り当てて
 * sourceHandle / targetHandle を再計算したエッジ配列を返す
 */
export function assignHandlesByPosition(
  nodes: GraphNodeType[],
  edges: GraphEdgeType[],
): GraphEdgeType[] {
  const centerById = new Map<string, Vec2>();
  for (const n of nodes) centerById.set(n.id, nodeCenter(n));

  const sideByEdge = new Map<
    string,
    { sourceSide: HandleSide; targetSide: HandleSide }
  >();

  // key = `${nodeId}|${side}`
  const groups = new Map<string, Attach[]>();
  const addAttach = (nodeId: string, att: Attach) => {
    const key = `${nodeId}|${att.side}`;
    const list = groups.get(key);
    if (list) list.push(att);
    else groups.set(key, [att]);
  };

  for (const e of edges) {
    const s = centerById.get(e.source);
    const t = centerById.get(e.target);
    if (!s || !t) continue;
    const sides = sidesForEdge(s, t);
    sideByEdge.set(e.id, sides);
    addAttach(e.source, {
      edgeId: e.id,
      role: "source",
      side: sides.sourceSide,
      other: t,
    });
    addAttach(e.target, {
      edgeId: e.id,
      role: "target",
      side: sides.targetSide,
      other: s,
    });
  }

  // 各 (ノード, 辺) グループ内を相手位置で並べ、スロット index を決定
  const indexByAttach = new Map<string, number>(); // key = `${edgeId}|${role}`
  for (const [key, list] of groups) {
    const side = key.slice(key.indexOf("|") + 1) as HandleSide;
    const horizontal = side === "left" || side === "right";
    list.sort((a, b) =>
      horizontal ? a.other.y - b.other.y : a.other.x - b.other.x,
    );
    list.forEach((att, i) => {
      indexByAttach.set(`${att.edgeId}|${att.role}`, i);
    });
  }

  return edges.map((e) => {
    const sides = sideByEdge.get(e.id);
    if (!sides) return e;
    const srcIndex = indexByAttach.get(`${e.id}|source`) ?? 0;
    const tgtIndex = indexByAttach.get(`${e.id}|target`) ?? 0;
    return {
      ...e,
      sourceHandle: makeHandleId(sides.sourceSide, srcIndex),
      targetHandle: makeHandleId(sides.targetSide, tgtIndex),
    };
  });
}
