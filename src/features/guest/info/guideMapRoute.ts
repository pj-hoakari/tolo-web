/**
 * 現在地 → 目的地の経路探索。
 * カードを障害物としたグリッド上で A* を実行し、直角に折れた綺麗な折れ線を返す。
 */

import type { GuideMapPoint } from "./guideMapSchema";

type Rect = { x: number; y: number; w: number; h: number };

/** 2 つの矩形が重なっているか（辺が接するだけは重なりとみなさない） */
function overlap(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

const DIRS = [
  { dc: 1, dr: 0 },
  { dc: -1, dr: 0 },
  { dc: 0, dr: 1 },
  { dc: 0, dr: -1 },
];

/** 曲がる回数を減らすためのコスト加算 */
const TURN_PENALTY = 0.4;

/** A* 用の最小ヒープ（優先度 p と状態 s を持つ） */
class MinHeap {
  private a: { p: number; s: number }[] = [];

  get size() {
    return this.a.length;
  }

  push(p: number, s: number) {
    const a = this.a;
    a.push({ p, s });
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent].p <= a[i].p) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      i = parent;
    }
  }

  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (last !== undefined && a.length > 0) {
      a[0] = last;
      let i = 0;
      const n = a.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let m = i;
        if (l < n && a[l].p < a[m].p) m = l;
        if (r < n && a[r].p < a[m].p) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/** 障害物に重なるセルを塞いだグリッドを作る */
function buildBlocked(
  obstacles: Rect[],
  cols: number,
  rows: number,
  grid: number,
): Uint8Array {
  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = { x: c * grid, y: r * grid, w: grid, h: grid };
      for (const o of obstacles) {
        if (overlap(cell, o)) {
          blocked[r * cols + c] = 1;
          break;
        }
      }
    }
  }
  return blocked;
}

/** A* で startIdx→endIdx の経由セルを求める（見つからなければ null） */
function findPath(
  blocked: Uint8Array,
  cols: number,
  rows: number,
  startIdx: number,
  endIdx: number,
): number[] | null {
  // 状態 = セル番号 * 5 + 進入方向（4 = 開始時／方向なし）
  const stateCount = cols * rows * 5;
  const g = new Float64Array(stateCount).fill(Number.POSITIVE_INFINITY);
  const prev = new Int32Array(stateCount).fill(-1);
  const eC = endIdx % cols;
  const eR = (endIdx / cols) | 0;
  const heuristic = (idx: number) =>
    Math.abs((idx % cols) - eC) + Math.abs(((idx / cols) | 0) - eR);

  const startState = startIdx * 5 + 4;
  g[startState] = 0;
  const heap = new MinHeap();
  heap.push(heuristic(startIdx), startState);

  let endState = -1;
  while (heap.size > 0) {
    const { s: cur } = heap.pop();
    const idx = (cur / 5) | 0;
    const dir = cur % 5;
    if (idx === endIdx) {
      endState = cur;
      break;
    }
    const c = idx % cols;
    const r = (idx / cols) | 0;
    const gc = g[cur];
    for (let d = 0; d < 4; d++) {
      const nc = c + DIRS[d].dc;
      const nr = r + DIRS[d].dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const nIdx = nr * cols + nc;
      if (blocked[nIdx]) continue;
      const step = 1 + (dir !== 4 && dir !== d ? TURN_PENALTY : 0);
      const ns = nIdx * 5 + d;
      const ng = gc + step;
      if (ng < g[ns]) {
        g[ns] = ng;
        prev[ns] = cur;
        heap.push(ng + heuristic(nIdx), ns);
      }
    }
  }

  if (endState === -1) return null;
  const cells: number[] = [];
  for (let s = endState; s !== -1; s = prev[s]) cells.push((s / 5) | 0);
  cells.reverse();
  return cells;
}

/** 経由セルを直角ポリラインに変換（直線上の中間点をまとめる） */
function simplify(
  cells: number[],
  cols: number,
  grid: number,
): GuideMapPoint[] {
  const raw: GuideMapPoint[] = cells.map((idx) => ({
    x: (idx % cols) * grid + grid / 2,
    y: ((idx / cols) | 0) * grid + grid / 2,
  }));
  const points: GuideMapPoint[] = [];
  for (const p of raw) {
    if (points.length >= 2) {
      const a = points[points.length - 2];
      const b = points[points.length - 1];
      const collinear =
        (a.y === b.y && b.y === p.y) || (a.x === b.x && b.x === p.x);
      if (collinear) {
        points[points.length - 1] = p;
        continue;
      }
    }
    points.push(p);
  }
  return points;
}

const clampCell = (v: number, max: number) => Math.min(max - 1, Math.max(0, v));

/**
 * start → end の経路を求める。obstacles に重なるセルは通らない。
 * 端点は指定座標そのものへ寄せて、現在地・目的地のマーカーと線が繋がるようにする。
 */
export function computeRoute(
  obstacles: Rect[],
  start: GuideMapPoint,
  end: GuideMapPoint,
  width: number,
  height: number,
  grid: number,
): GuideMapPoint[] {
  if (width <= 0 || height <= 0) return [];
  const cols = Math.max(1, Math.ceil(width / grid));
  const rows = Math.max(1, Math.ceil(height / grid));
  const blocked = buildBlocked(obstacles, cols, rows, grid);

  const sIdx =
    clampCell(Math.floor(start.y / grid), rows) * cols +
    clampCell(Math.floor(start.x / grid), cols);
  const eIdx =
    clampCell(Math.floor(end.y / grid), rows) * cols +
    clampCell(Math.floor(end.x / grid), cols);
  // 現在地・目的地のセルは必ず通れるようにする
  blocked[sIdx] = 0;
  blocked[eIdx] = 0;

  const cells = findPath(blocked, cols, rows, sIdx, eIdx);
  if (!cells) return [];

  const points = simplify(cells, cols, grid);
  if (points.length < 2) return [];
  points[0] = start;
  points[points.length - 1] = end;
  return points;
}
