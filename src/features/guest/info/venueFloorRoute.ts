/**
 * 階をまたぐ経路探索（guide-map-poc の lib/venue-floor-route.ts と同じ挙動）。
 * - 各階の中は computeRoute（壁を避けた道なり）で歩く
 * - 階と階は階移動ポイント（階段・エスカレーター・エレベーター）でつなぐ。同じ link 同士が移動できる
 * - 出発・目的地・階移動ポイントを頂点にしたグラフで、歩く距離＋乗り換えの手間が最小の道を選ぶ
 * - 混雑（crowd）を渡すと混雑回避ルートにする。混んだ階段・エレベーターは手間を重くし、危険の所は通らない。
 *   危険を避けると行けないときだけ、危険を通る道で引き直して throughDanger を立てる
 */

import {
  type ConnectorObject,
  type ConnectorType,
  type CrowdLevel,
  type CrowdMap,
  floorSize,
  isConnector,
  type Pt,
  type VenueMapDoc,
} from "./venueMapDoc";
import { computeRoute } from "./venueRoute";

/** 階移動の手間（px 換算）。base＝乗るまで、perFloor＝1 階分あたり */
const TRANSFER_COST: Record<ConnectorType, { base: number; perFloor: number }> =
  {
    stairs: { base: 40, perFloor: 240 },
    escalator: { base: 40, perFloor: 140 },
    elevator: { base: 360, perFloor: 40 },
  };
/** 混雑した階移動ポイントに足す手間（px 換算）。危険は avoidDanger のとき使わない、そうでなければ DANGER_RIDE_COST */
const CROWD_RIDE_COST: Record<CrowdLevel, number> = {
  low: 0,
  mid: 200,
  high: 600,
};
const DANGER_RIDE_COST = 1200;

export type FloorRouteStep =
  | { kind: "walk"; floor: string; points: Pt[]; fromId: string; toId: string }
  | {
      kind: "ride";
      via: ConnectorType;
      fromFloor: string;
      toFloor: string;
      fromId: string;
      toId: string;
    };

/** throughDanger＝危険を避けると行けず、危険の所を通る道にした */
export type FloorRouteResult =
  | { steps: FloorRouteStep[]; throughDanger?: boolean }
  | { error: "no-connector" | "unreachable" };

export type FloorRouteOptions = {
  /** オブジェクト id → 混雑（混雑回避ルート） */
  crowd?: CrowdMap;
};

/**
 * 頂点の役割。start＝出発、goal＝目的地、in＝歩いて階移動ポイントに着いた（次は乗るだけ）、
 * out＝乗って着いた（次は歩くだけ）。in / out に分けることで、同じ階のまま
 * 階移動ポイントを「近道」として素通りする経路を作らない。
 */
type Node = {
  id: string;
  floor: string;
  x: number;
  y: number;
  role: "start" | "goal" | "in" | "out";
  connector?: ConnectorObject;
};

const pathLength = (pts: Pt[]) =>
  pts.reduce(
    (sum, p, i) =>
      i === 0 ? 0 : sum + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y),
    0,
  );

/** 出発（startId）→目的地（goalId）の経路。階が違えば階移動ポイントを経由する。混雑を渡せば混雑回避ルート */
export function computeFloorRoute(
  doc: Pick<VenueMapDoc, "floors" | "objects">,
  startId: string,
  goalId: string,
  opts: FloorRouteOptions = {},
): FloorRouteResult {
  if (!opts.crowd || opts.crowd.size === 0)
    return routeOnce(doc, startId, goalId, opts, true);
  const avoided = routeOnce(doc, startId, goalId, opts, true);
  if ("steps" in avoided) return avoided;
  const through = routeOnce(doc, startId, goalId, opts, false);
  return "steps" in through ? { ...through, throughDanger: true } : avoided;
}

function routeOnce(
  doc: Pick<VenueMapDoc, "floors" | "objects">,
  startId: string,
  goalId: string,
  opts: FloorRouteOptions,
  avoidDanger: boolean,
): FloorRouteResult {
  const start = doc.objects.find((o) => o.id === startId);
  const goal = doc.objects.find((o) => o.id === goalId);
  if (!start || !goal || start.kind !== "place" || goal.kind !== "place")
    return { error: "unreachable" };

  const floorIndex = new Map(doc.floors.map((f, i) => [f.id, i]));
  const connectors = doc.objects
    .filter(isConnector)
    .filter((c) => floorIndex.has(c.floor));
  const nodes: Node[] = [
    { id: start.id, floor: start.floor, x: start.x, y: start.y, role: "start" },
    { id: goal.id, floor: goal.floor, x: goal.x, y: goal.y, role: "goal" },
    ...connectors.flatMap((c): Node[] => [
      { id: c.id, floor: c.floor, x: c.x, y: c.y, role: "in", connector: c },
      { id: c.id, floor: c.floor, x: c.x, y: c.y, role: "out", connector: c },
    ]),
  ];

  // 出発階から別の階へ行ける階移動ポイントが無ければ、階をまたげない
  if (start.floor !== goal.floor) {
    const usable = connectors.some(
      (c) =>
        c.floor === start.floor &&
        connectors.some((d) => d.link === c.link && d.floor !== c.floor),
    );
    if (!usable) return { error: "no-connector" };
  }

  // 同じ階の 2 点間は道なり（重いので必要になった時だけ計算してキャッシュ）
  const walkCache = new Map<string, Pt[] | null>();
  const walk = (a: Node, b: Node): Pt[] | null => {
    const cacheKey = `${a.id}>${b.id}`;
    const cached = walkCache.get(cacheKey);
    if (cached !== undefined) return cached;
    const rev = walkCache.get(`${b.id}>${a.id}`);
    if (rev !== undefined) return rev && [...rev].reverse();
    const { w, h } = floorSize(doc.floors.find((f) => f.id === a.floor));
    const objects = doc.objects.filter((o) => o.floor === a.floor);
    const pts = computeRoute(
      objects,
      { x: a.x, y: a.y },
      { x: b.x, y: b.y },
      w,
      h,
      { crowd: opts.crowd, avoidDanger },
    );
    walkCache.set(cacheKey, pts);
    return pts;
  };
  // 階移動ポイント a → b に乗れるか（同じ link・別の階・エスカレーターの向き）と、その手間
  const rideCost = (a: Node, b: Node): number | null => {
    if (
      !a.connector ||
      !b.connector ||
      a.connector.link !== b.connector.link ||
      a.floor === b.floor
    )
      return null;
    const from = floorIndex.get(a.floor) ?? 0;
    const to = floorIndex.get(b.floor) ?? 0;
    const dir = a.connector.direction ?? "both";
    if ((dir === "up" && to <= from) || (dir === "down" && to >= from))
      return null;
    // 乗る所・降りる所が混んでいれば手間を足す。危険なら（避けるときは）使わない
    let crowdCost = 0;
    for (const id of [a.id, b.id]) {
      const s = opts.crowd?.get(id);
      if (!s) continue;
      if (s.danger && avoidDanger) return null;
      crowdCost += s.danger ? DANGER_RIDE_COST : CROWD_RIDE_COST[s.level];
    }
    const t = TRANSFER_COST[a.connector.connector];
    return t.base + t.perFloor * Math.abs(to - from) + crowdCost;
  };

  // ダイクストラ（頂点数は少ないので配列走査で十分）
  const n = nodes.length;
  const dist = new Array<number>(n).fill(Number.POSITIVE_INFINITY);
  const prev = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++)
      if (
        !done[i] &&
        dist[i] < Number.POSITIVE_INFINITY &&
        (u < 0 || dist[i] < dist[u])
      )
        u = i;
    if (u < 0 || u === 1) break;
    done[u] = true;
    for (let v = 0; v < n; v++) {
      if (done[v] || v === 0) continue;
      const a = nodes[u];
      const b = nodes[v];
      let cost: number | null = null;
      if (a.role === "in" && b.role === "out") {
        cost = rideCost(a, b); // 乗る（別の階へ）
      } else if (
        a.floor === b.floor &&
        (a.role === "start" || a.role === "out") &&
        (b.role === "goal" || b.role === "in")
      ) {
        const pts = walk(a, b); // 歩く（同じ階）
        cost = pts ? pathLength(pts) : null;
      }
      if (cost !== null && dist[u] + cost < dist[v]) {
        dist[v] = dist[u] + cost;
        prev[v] = u;
      }
    }
  }
  if (dist[1] === Number.POSITIVE_INFINITY) return { error: "unreachable" };

  const order: number[] = [];
  for (let k = 1; k >= 0; k = prev[k]) order.unshift(k);
  const steps: FloorRouteStep[] = [];
  for (let i = 0; i < order.length - 1; i++) {
    const a = nodes[order[i]];
    const b = nodes[order[i + 1]];
    if (!(a.role === "in" && b.role === "out")) {
      steps.push({
        kind: "walk",
        floor: a.floor,
        points: walk(a, b) ?? [],
        fromId: a.id,
        toId: b.id,
      });
    } else if (a.connector) {
      steps.push({
        kind: "ride",
        via: a.connector.connector,
        fromFloor: a.floor,
        toFloor: b.floor,
        fromId: a.id,
        toId: b.id,
      });
    }
  }
  return { steps };
}
