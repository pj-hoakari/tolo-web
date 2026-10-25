/**
 * 案内マップの 1 フロア内の経路探索（guide-map-poc の lib/venue-route.ts と同じ挙動）。
 * - 四角・丸（部屋・区画）と、階段・エレベーターのマークは「壁」、そのすき間が「歩ける道」
 * - 壁を避けて、縦横だけの直角な線で出発→目的地をつなぐ（曲がる回数はできるだけ少なく）
 * - 通路の中央寄りを通るよう、壁に近い所ほど通りにくくする
 * - 出発と目的地が同じエリア（建物など）の中にあれば、そのエリアの外には出ない
 * - closed（通行止め）のエリアは障害物として扱う
 * - 混雑（crowd）を渡すと、混んでいるエリア・通路・場所のまわりは通りにくくし、危険（danger）の所は通らない（混雑回避ルート）
 */

import {
  type CrowdLevel,
  type CrowdMap,
  distToSegment,
  isConnector,
  MARKER_SIZE_DEFAULT,
  type MapObject,
  markBoxOf,
  type Pt,
  pointInPolygon,
} from "./guideMapLayout";

/** 探索グリッドの刻み（px） */
const CELL = 16;
/** 壁からの最小クリアランス */
const INFLATE = 10;
/** この距離（セル）まで壁から離れたいという目標 */
const CLEAR_CELLS = 5;
/** 壁に近いほどコスト増（中央寄せの強さ） */
const CLEAR_WEIGHT = 0.9;
/** 曲がるたびに足すコスト（セル換算）。大きいほど曲がりの少ない線になる */
const TURN_COST = 6;
/** 混雑の通りにくさ（1 セル進むごとに足すコスト）。危険は avoidDanger のとき通れない、そうでなければ DANGER_COST */
const CROWD_COST: Record<CrowdLevel, number> = { low: 0, mid: 1.5, high: 4 };
const DANGER_COST = 8;
/** 混雑したピンのまわりの範囲（px） */
const CROWD_PIN_RADIUS = 64;
/** 混雑した部屋・階移動マーク・通路の線のまわりに足す範囲（px） */
const CROWD_PAD = 32;

export type RouteOptions = {
  /** オブジェクト id → 混雑 */
  crowd?: CrowdMap;
  /** 危険の所を通れなくする（既定 true）。行けないときに false で引き直す */
  avoidDanger?: boolean;
};

type CrowdZone = { inside: (p: Pt) => boolean; cost: number; danger: boolean };

/** 混雑したオブジェクトの「混んでいる範囲」。エリアはその中、線は線のまわり、場所はそのまわり */
function buildCrowdZones(
  objects: MapObject[],
  crowd: CrowdMap | undefined,
): CrowdZone[] {
  if (!crowd || crowd.size === 0) return [];
  const zones: CrowdZone[] = [];
  for (const o of objects) {
    const s = crowd.get(o.id);
    if (!s || (!s.danger && CROWD_COST[s.level] === 0)) continue;
    const cost = CROWD_COST[s.level];
    let inside: ((p: Pt) => boolean) | null = null;
    if (o.kind === "area" && o.points.length >= 3)
      inside = (p) => pointInPolygon(p, o.points);
    else if (o.kind === "route" && o.points.length >= 2) {
      const reach = o.width / 2 + CROWD_PAD;
      inside = (p) =>
        o.points.some(
          (a, i) => i > 0 && distToSegment(p, o.points[i - 1], a) <= reach,
        );
    } else if (o.kind === "place") {
      if (o.shape === "pin" && !isConnector(o))
        inside = (p) => Math.hypot(p.x - o.x, p.y - o.y) <= CROWD_PIN_RADIUS;
      else {
        const { w, h } =
          isConnector(o) && o.shape === "pin"
            ? markBoxOf(o, MARKER_SIZE_DEFAULT)
            : { w: o.w, h: o.h };
        inside = (p) =>
          Math.abs(p.x - o.x) <= w / 2 + CROWD_PAD &&
          Math.abs(p.y - o.y) <= h / 2 + CROWD_PAD;
      }
    }
    if (inside) zones.push({ inside, cost, danger: s.danger });
  }
  return zones;
}

type Obstacle =
  | { kind: "rect"; cx: number; cy: number; hw: number; hh: number }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "poly"; points: Pt[] };

const insideBox = (p: Pt, cx: number, cy: number, w: number, h: number) =>
  Math.abs(p.x - cx) <= w / 2 && Math.abs(p.y - cy) <= h / 2;

/** start / goal が内側にある図形は、出入りできるよう障害物から外す */
function buildObstacles(objects: MapObject[], start: Pt, goal: Pt) {
  const obs: Obstacle[] = [];
  for (const o of objects) {
    if (o.kind === "place" && (o.shape === "rect" || o.shape === "circle")) {
      if (
        insideBox(start, o.x, o.y, o.w, o.h) ||
        insideBox(goal, o.x, o.y, o.w, o.h)
      )
        continue;
      if (o.shape === "rect")
        obs.push({ kind: "rect", cx: o.x, cy: o.y, hw: o.w / 2, hh: o.h / 2 });
      else
        obs.push({
          kind: "ellipse",
          cx: o.x,
          cy: o.y,
          rx: o.w / 2,
          ry: o.h / 2,
        });
    } else if (o.kind === "place" && isConnector(o)) {
      // ピン型の階段・エレベーターのマークも壁（そこを目指すときは入れる）
      const { w, h } = markBoxOf(o, MARKER_SIZE_DEFAULT);
      if (insideBox(start, o.x, o.y, w, h) || insideBox(goal, o.x, o.y, w, h))
        continue;
      obs.push({ kind: "rect", cx: o.x, cy: o.y, hw: w / 2, hh: h / 2 });
    } else if (o.kind === "area" && o.closed) {
      obs.push({ kind: "poly", points: o.points });
    }
  }
  return obs;
}

function makeBlocked(obs: Obstacle[], inflate: number) {
  return (p: Pt): boolean => {
    for (const o of obs) {
      if (o.kind === "rect") {
        if (
          Math.abs(p.x - o.cx) <= o.hw + inflate &&
          Math.abs(p.y - o.cy) <= o.hh + inflate
        )
          return true;
      } else if (o.kind === "ellipse") {
        const nx = (p.x - o.cx) / (o.rx + inflate);
        const ny = (p.y - o.cy) / (o.ry + inflate);
        if (nx * nx + ny * ny <= 1) return true;
      } else if (pointInPolygon(p, o.points)) return true;
    }
    return false;
  };
}

function nearestFree(
  p: Pt,
  blocked: (q: Pt) => boolean,
  w: number,
  h: number,
): Pt {
  if (!blocked(p)) return p;
  for (let r = CELL; r <= 12 * CELL; r += CELL) {
    for (let a = 0; a < 360; a += 20) {
      const q = {
        x: p.x + Math.cos((a * Math.PI) / 180) * r,
        y: p.y + Math.sin((a * Math.PI) / 180) * r,
      };
      if (q.x >= 0 && q.y >= 0 && q.x <= w && q.y <= h && !blocked(q)) return q;
    }
  }
  return p;
}

/** 小さな二分ヒープ（A* の候補を f の小さい順に取り出す） */
class MinHeap {
  private f: number[] = [];
  private v: number[] = [];
  get size() {
    return this.v.length;
  }
  push(f: number, v: number) {
    this.f.push(f);
    this.v.push(v);
    let i = this.v.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.f[p] <= this.f[i]) break;
      this.swap(p, i);
      i = p;
    }
  }
  pop(): number {
    const top = this.v[0];
    const lf = this.f.pop() ?? 0;
    const lv = this.v.pop() ?? 0;
    if (this.v.length > 0) {
      this.f[0] = lf;
      this.v[0] = lv;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.v.length && this.f[l] < this.f[m]) m = l;
        if (r < this.v.length && this.f[r] < this.f[m]) m = r;
        if (m === i) break;
        this.swap(m, i);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.f[a], this.f[b]] = [this.f[b], this.f[a]];
    [this.v[a], this.v[b]] = [this.v[b], this.v[a]];
  }
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

const near = (a: number, b: number) => Math.abs(a - b) < 0.5;

/** 出発・目的地の点に、最初と最後の直線をそろえて（小さな段差を作らず）つなぐ */
function alignEnd(pts: Pt[], p: Pt, fromStart: boolean) {
  if (pts.length < 2) return;
  const i0 = fromStart ? 0 : pts.length - 1;
  const i1 = fromStart ? 1 : pts.length - 2;
  if (pts[i0].x === pts[i1].x) {
    pts[i0] = { x: p.x, y: pts[i0].y };
    pts[i1] = { x: p.x, y: pts[i1].y };
  } else {
    pts[i0] = { x: pts[i0].x, y: p.y };
    pts[i1] = { x: pts[i1].x, y: p.y };
  }
}

/** 出発→目的地の経路（壁を避け、縦横の直角な線で、通路の中央寄りを通る点列）。到達できなければ null */
export function computeRoute(
  objects: MapObject[],
  start: Pt,
  goal: Pt,
  floorW: number,
  floorH: number,
  opts: RouteOptions = {},
): Pt[] | null {
  // 探索範囲：キャンバスの大きさより外に置いた項目もあるので、全部（＋余白）が入るまで広げる
  let maxX = Math.max(floorW, start.x, goal.x);
  let maxY = Math.max(floorH, start.y, goal.y);
  for (const o of objects) {
    if (o.kind === "place") {
      maxX = Math.max(maxX, o.x + o.w / 2);
      maxY = Math.max(maxY, o.y + o.h / 2);
    } else if (o.kind === "text") {
      maxX = Math.max(maxX, o.x);
      maxY = Math.max(maxY, o.y);
    } else {
      for (const pt of o.points) {
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      }
    }
  }
  const worldW = Math.ceil(maxX + CELL * 4);
  const worldH = Math.ceil(maxY + CELL * 4);

  // 出発と目的地が同じエリア（建物の枠など）の中なら、その外には出ない
  const confine = objects.find(
    (o) =>
      o.kind === "area" &&
      !o.closed &&
      pointInPolygon(start, o.points) &&
      pointInPolygon(goal, o.points),
  );
  const wall = makeBlocked(buildObstacles(objects, start, goal), INFLATE);
  const confined =
    confine?.kind === "area"
      ? (p: Pt) => !pointInPolygon(p, confine.points) || wall(p)
      : wall;
  // 混雑：危険の所は（出発・目的地を含まない限り）通れなくする。それ以外は通りにくさとして足す
  const zones = buildCrowdZones(objects, opts.crowd);
  const avoidDanger = opts.avoidDanger ?? true;
  const blockZones = avoidDanger
    ? zones.filter((z) => z.danger && !z.inside(start) && !z.inside(goal))
    : [];
  const costZones = zones.filter((z) => !blockZones.includes(z));
  const hardBlocked =
    blockZones.length > 0
      ? (p: Pt) => confined(p) || blockZones.some((z) => z.inside(p))
      : confined;

  const cols = Math.ceil(worldW / CELL) + 1;
  const rows = Math.ceil(worldH / CELL) + 1;
  const n = cols * rows;
  const key = (c: number, r: number) => r * cols + c;
  const toPt = (c: number, r: number): Pt => ({ x: c * CELL, y: r * CELL });

  // セルごとの通行可否と「壁までの距離（セル）」を多ソース BFS で求める（中央寄せに使う）
  const blockedCell = new Uint8Array(n);
  const dist = new Int32Array(n).fill(-1);
  const queue: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = key(c, r);
      const isBorder = c === 0 || r === 0 || c === cols - 1 || r === rows - 1;
      const blk = hardBlocked(toPt(c, r));
      if (blk) blockedCell[idx] = 1;
      if (blk || isBorder) {
        dist[idx] = 0;
        queue.push(idx);
      }
    }
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const idx = queue[qi];
    const c = idx % cols;
    const r = (idx - c) / cols;
    for (const [dc, dr] of DIRS) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ni = key(nc, nr);
      if (dist[ni] === -1) {
        dist[ni] = dist[idx] + 1;
        queue.push(ni);
      }
    }
  }
  // 混雑の通りにくさをセルごとに先に求めておく
  const crowdCost = new Float32Array(n);
  if (costZones.length > 0)
    for (let idx = 0; idx < n; idx++) {
      if (blockedCell[idx]) continue;
      const p = toPt(idx % cols, Math.floor(idx / cols));
      for (const z of costZones)
        if (z.inside(p)) crowdCost[idx] += z.danger ? DANGER_COST : z.cost;
    }
  const penalty = (idx: number) =>
    (dist[idx] >= CLEAR_CELLS ? 0 : (CLEAR_CELLS - dist[idx]) * CLEAR_WEIGHT) +
    crowdCost[idx];

  const s = nearestFree(start, hardBlocked, worldW, worldH);
  const g = nearestFree(goal, hardBlocked, worldW, worldH);
  const clampCol = (x: number) =>
    Math.min(cols - 1, Math.max(0, Math.round(x / CELL)));
  const clampRow = (y: number) =>
    Math.min(rows - 1, Math.max(0, Math.round(y / CELL)));
  const sc = clampCol(s.x);
  const sr = clampRow(s.y);
  const gc = clampCol(g.x);
  const gr = clampRow(g.y);
  const goalKey = key(gc, gr);

  // A*：状態＝（セル, 進んできた向き）。曲がるたびに TURN_COST を足し、直角で曲がりの少ない道を選ぶ
  const states = n * 4;
  const gScore = new Float64Array(states).fill(Number.POSITIVE_INFINITY);
  const came = new Int32Array(states).fill(-1);
  const heap = new MinHeap();
  const h = (c: number, r: number) => Math.abs(c - gc) + Math.abs(r - gr);
  for (let d = 0; d < 4; d++) {
    const st = key(sc, sr) * 4 + d;
    gScore[st] = 0;
    heap.push(h(sc, sr), st);
  }
  let end = -1;
  let guard = 0;
  while (heap.size && guard++ < states * 6) {
    const cur = heap.pop();
    const cell = (cur / 4) | 0;
    const d = cur % 4;
    if (cell === goalKey) {
      end = cur;
      break;
    }
    const cc = cell % cols;
    const cr = (cell - cc) / cols;
    for (let nd = 0; nd < 4; nd++) {
      const nc = cc + DIRS[nd][0];
      const nr = cr + DIRS[nd][1];
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const nk = key(nc, nr);
      if (blockedCell[nk] && nk !== goalKey) continue;
      const t =
        gScore[cur] +
        1 +
        penalty(nk) +
        (nd !== d && gScore[cur] > 0 ? TURN_COST : 0);
      const ns = nk * 4 + nd;
      if (t < gScore[ns]) {
        gScore[ns] = t;
        came[ns] = cur;
        heap.push(t + h(nc, nr), ns);
      }
    }
  }
  if (end < 0) return null;

  // セル列を復元
  const cells: number[] = [];
  for (let st = end; st >= 0; st = came[st]) cells.push((st / 4) | 0);
  cells.reverse();
  const grid = cells.map((c) => toPt(c % cols, Math.floor(c / cols)));

  // 向きが変わる所（曲がり角）だけ残す
  const corners: Pt[] = [grid[0]];
  for (let i = 1; i < grid.length - 1; i++) {
    const a = corners[corners.length - 1];
    const b = grid[i];
    const c = grid[i + 1];
    const sameLine =
      (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
    if (!sameLine) corners.push(b);
  }
  if (grid.length > 1) corners.push(grid[grid.length - 1]);

  if (corners.length >= 2) {
    alignEnd(corners, start, true);
    if (corners.length >= 3) alignEnd(corners, goal, false);
  }

  // 重なった点・一直線上の点を取り除く
  const out: Pt[] = [];
  for (const p of [start, ...corners, goal]) {
    const last = out[out.length - 1];
    if (last && near(last.x, p.x) && near(last.y, p.y)) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2];
      const b = out[out.length - 1];
      if (
        (near(a.x, b.x) && near(b.x, p.x)) ||
        (near(a.y, b.y) && near(b.y, p.y))
      ) {
        out[out.length - 1] = p;
        continue;
      }
    }
    out.push(p);
  }

  // まだ斜めの区間が残っていれば、角を 1 つはさんで縦横だけにする（前の区間の向きを続ける）
  const ortho: Pt[] = [out[0]];
  for (let i = 1; i < out.length; i++) {
    const a = ortho[ortho.length - 1];
    const b = out[i];
    if (!near(a.x, b.x) && !near(a.y, b.y)) {
      const prev = ortho[ortho.length - 2];
      const wasVertical = prev
        ? near(prev.x, a.x)
        : Math.abs(b.y - a.y) > Math.abs(b.x - a.x);
      ortho.push(wasVertical ? { x: a.x, y: b.y } : { x: b.x, y: a.y });
    }
    ortho.push(b);
  }
  return ortho;
}
