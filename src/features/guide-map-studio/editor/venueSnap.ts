// スマートガイド：ドラッグ中の項目を、ほかの項目の「端・中央」にそろえたり、
// 隣どうしの「すき間」を等しくそろえたりする（Figma のような吸着＋ガイド線）。

import { bboxOf, isConnector, type MapObject, markBoxOf } from "./venueMap";

export type Box = { l: number; t: number; r: number; b: number };
export type GuideLine = { x1: number; y1: number; x2: number; y2: number };
// 等間隔の目印：すき間の区間（両端）と、その長さ
export type GapMark = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  size: number;
};
export type SnapResult = {
  dx: number;
  dy: number;
  lines: GuideLine[];
  gaps: GapMark[];
};

/** 項目の外接矩形（ピン・文字は点＝大きさ 0 として扱う） */
export function boxOf(o: MapObject): Box {
  if (o.kind === "place") {
    if (o.shape === "pin" && isConnector(o)) {
      const { w, h } = markBoxOf(o);
      return { l: o.x - w / 2, t: o.y - h / 2, r: o.x + w / 2, b: o.y + h / 2 };
    }
    if (o.shape === "pin") return { l: o.x, t: o.y, r: o.x, b: o.y };
    return {
      l: o.x - o.w / 2,
      t: o.y - o.h / 2,
      r: o.x + o.w / 2,
      b: o.y + o.h / 2,
    };
  }
  if (o.kind === "text") return { l: o.x, t: o.y, r: o.x, b: o.y };
  const bb = bboxOf(o.points);
  return { l: bb.x, t: bb.y, r: bb.x + bb.w, b: bb.y + bb.h };
}

export function unionBox(boxes: Box[]): Box {
  return {
    l: Math.min(...boxes.map((b) => b.l)),
    t: Math.min(...boxes.map((b) => b.t)),
    r: Math.max(...boxes.map((b) => b.r)),
    b: Math.max(...boxes.map((b) => b.b)),
  };
}

type Axis = "x" | "y";
// 軸ごとの見方：x 軸なら 始まり=l 終わり=r、交差方向=t/b
const lo = (b: Box, a: Axis) => (a === "x" ? b.l : b.t);
const hi = (b: Box, a: Axis) => (a === "x" ? b.r : b.b);
const crossLo = (b: Box, a: Axis) => (a === "x" ? b.t : b.l);
const crossHi = (b: Box, a: Axis) => (a === "x" ? b.b : b.r);
const shift = (b: Box, a: Axis, d: number): Box =>
  a === "x"
    ? { ...b, l: b.l + d, r: b.r + d }
    : { ...b, t: b.t + d, b: b.b + d };
// 交差方向に重なっている（＝同じ列・同じ行に並んでいる）か
const sameRow = (p: Box, q: Box, a: Axis) =>
  crossLo(p, a) < crossHi(q, a) && crossHi(p, a) > crossLo(q, a);

type Candidate = { diff: number; gaps: GapMark[] };

// 同じ行（列）に並ぶ項目のうち、隣り合うペアのすき間（間に別の項目をはさむペアは除く）
function adjacentGaps(row: Box[], a: Axis): { p: Box; q: Box; g: number }[] {
  const out: { p: Box; q: Box; g: number }[] = [];
  for (const p of row) {
    // p のすぐ後ろ（同じ行で、間に何もない）
    const q = row
      .filter((o) => o !== p && sameRow(p, o, a) && lo(o, a) >= hi(p, a))
      .sort((x, y) => lo(x, a) - lo(y, a))[0];
    if (!q) continue;
    const between = row.some(
      (o) =>
        o !== p &&
        o !== q &&
        lo(o, a) >= hi(p, a) &&
        hi(o, a) <= lo(q, a) &&
        sameRow(o, p, a),
    );
    const g = lo(q, a) - hi(p, a);
    if (!between && g > 0) out.push({ p, q, g });
  }
  return out;
}

// 1軸ぶんの吸着。m＝動かしている矩形（生の移動量を反映済み）
function snapAxis(
  m: Box,
  others: Box[],
  a: Axis,
  tol: number,
): Candidate | null {
  let best: Candidate | null = null;
  let bestScore = Infinity;
  // 等間隔（gaps あり）は、端そろえより優先する（間に置きたいときは「すき間をそろえる」意図が強いため）
  const consider = (diff: number, gaps: GapMark[] = []) => {
    if (Math.abs(diff) > tol) return;
    const score = Math.abs(diff) - (gaps.length ? tol : 0);
    if (score < bestScore - 0.01) {
      bestScore = score;
      best = { diff, gaps };
    }
  };
  const mEdges = [lo(m, a), (lo(m, a) + hi(m, a)) / 2, hi(m, a)];
  // 端・中央そろえ
  for (const o of others) {
    const oEdges = [lo(o, a), (lo(o, a) + hi(o, a)) / 2, hi(o, a)];
    for (const me of mEdges) for (const oe of oEdges) consider(oe - me);
  }

  // 等間隔：同じ行（列）に並んでいる項目のすき間にそろえる
  // ピン・文字（大きさ 0）は端そろえには使うが、すき間の計算には入れない
  const row = others.filter((o) => sameRow(o, m, a) && hi(o, a) - lo(o, a) > 0);
  const size = hi(m, a) - lo(m, a);
  const mark = (from: number, to: number, cross: number): GapMark =>
    a === "x"
      ? { x1: from, y1: cross, x2: to, y2: cross, size: Math.round(to - from) }
      : { x1: cross, y1: from, x2: cross, y2: to, size: Math.round(to - from) };
  const crossMid = (p: Box, q: Box) =>
    (Math.max(crossLo(p, a), crossLo(q, a)) +
      Math.min(crossHi(p, a), crossHi(q, a))) /
    2;
  const before = row
    .filter((o) => hi(o, a) <= lo(m, a) + tol)
    .sort((p, q) => hi(q, a) - hi(p, a))[0]; // すぐ手前
  const after = row
    .filter((o) => lo(o, a) >= hi(m, a) - tol)
    .sort((p, q) => lo(p, a) - lo(q, a))[0]; // すぐ後ろ
  // (1) 手前と後ろのちょうど真ん中（両側のすき間が同じ）
  if (before && after) {
    const start = (hi(before, a) + lo(after, a) - size) / 2;
    const gap = start - hi(before, a);
    if (gap > 0) {
      const sm = shift(m, a, start - lo(m, a));
      consider(start - lo(m, a), [
        mark(hi(before, a), start, crossMid(before, sm)),
        mark(start + size, lo(after, a), crossMid(after, sm)),
      ]);
    }
  }
  // (2) 隣り合うほかの2つの間と同じすき間で、手前／後ろに並べる
  for (const { p, q, g } of adjacentGaps(row, a)) {
    const ref = mark(hi(p, a), lo(q, a), crossMid(p, q));
    if (before) {
      const start = hi(before, a) + g;
      consider(start - lo(m, a), [
        ref,
        mark(
          hi(before, a),
          start,
          crossMid(before, shift(m, a, start - lo(m, a))),
        ),
      ]);
    }
    if (after) {
      const end = lo(after, a) - g;
      consider(end - hi(m, a), [
        ref,
        mark(end, lo(after, a), crossMid(after, shift(m, a, end - hi(m, a)))),
      ]);
    }
  }
  return best;
}

// 吸着後にそろっている端・中央に、ガイド線を引く
function alignLines(m: Box, others: Box[], a: Axis): GuideLine[] {
  const lines: GuideLine[] = [];
  const mEdges = [lo(m, a), (lo(m, a) + hi(m, a)) / 2, hi(m, a)];
  for (const o of others) {
    const oEdges = [lo(o, a), (lo(o, a) + hi(o, a)) / 2, hi(o, a)];
    for (const v of mEdges) {
      if (!oEdges.some((e) => Math.abs(e - v) < 0.5)) continue;
      const c1 = Math.min(crossLo(m, a), crossLo(o, a));
      const c2 = Math.max(crossHi(m, a), crossHi(o, a));
      lines.push(
        a === "x"
          ? { x1: v, y1: c1, x2: v, y2: c2 }
          : { x1: c1, y1: v, x2: c2, y2: v },
      );
    }
  }
  return lines;
}

/**
 * 動かしている矩形 moving（移動前）を rawDx/rawDy だけ動かしたとき、近くの端・中央・等間隔に吸着した移動量を返す。
 * 吸着先が無い軸は grid の刻みにそろえる（従来どおりグリッドにも揃う）。
 */
export function smartSnap(
  moving: Box,
  others: Box[],
  rawDx: number,
  rawDy: number,
  tol: number,
  grid: number,
): SnapResult {
  const m0 = {
    l: moving.l + rawDx,
    r: moving.r + rawDx,
    t: moving.t + rawDy,
    b: moving.b + rawDy,
  };
  const sx = snapAxis(m0, others, "x", tol) as Candidate | null;
  const sy = snapAxis(m0, others, "y", tol) as Candidate | null;
  const dx = sx ? rawDx + sx.diff : Math.round(rawDx / grid) * grid;
  const dy = sy ? rawDy + sy.diff : Math.round(rawDy / grid) * grid;
  const m = {
    l: moving.l + dx,
    r: moving.r + dx,
    t: moving.t + dy,
    b: moving.b + dy,
  };
  return {
    dx,
    dy,
    lines: [
      ...(sx ? alignLines(m, others, "x") : []),
      ...(sy ? alignLines(m, others, "y") : []),
    ],
    gaps: [...(sx?.gaps ?? []), ...(sy?.gaps ?? [])],
  };
}

export type ResizeSnap = {
  x: number;
  y: number;
  lines: GuideLine[];
  gaps: GapMark[];
};

/**
 * 角をつかんで大きさを変えるとき：fixed＝反対側の角（動かない）、q＝つかんでいる角の生の位置。
 * 動かしている辺を、ほかの項目の「端・中央」か「同じ幅／同じ高さ」に吸着させる。
 * 吸着しない軸は round（グリッド等）でそろえる。
 */
export function snapResize(
  fixed: { x: number; y: number },
  q: { x: number; y: number },
  others: Box[],
  tol: number,
  round: (v: number) => number,
): ResizeSnap {
  const axis = (a: Axis) => {
    const f = a === "x" ? fixed.x : fixed.y;
    const e = a === "x" ? q.x : q.y;
    const dir = e >= f ? 1 : -1;
    let best: {
      v: number;
      size?: number;
      gap?: { ref: [Box, Box]; g: number; next: Box };
    } | null = null;
    let bestScore = Infinity;
    const consider = (v: number, size?: number) => {
      const diff = v - e;
      if (Math.abs(diff) > tol) return;
      // 同じ大きさにそろえる方を少し優先（大きさをそろえたい意図が強いため）
      const score = Math.abs(diff) - (size !== undefined ? tol * 0.5 : 0);
      if (score < bestScore - 0.01) {
        bestScore = score;
        best = { v, size };
      }
    };
    for (const o of others) {
      for (const v of [lo(o, a), (lo(o, a) + hi(o, a)) / 2, hi(o, a)])
        consider(v);
      const size = hi(o, a) - lo(o, a);
      if (size > 0) consider(f + dir * size, size);
    }
    // 等間隔：動かしている辺と、その先の隣の項目とのすき間を、ほかの隣り合うすき間と同じにする
    const cross =
      a === "x"
        ? [Math.min(fixed.y, q.y), Math.max(fixed.y, q.y)]
        : [Math.min(fixed.x, q.x), Math.max(fixed.x, q.x)];
    const cur: Box =
      a === "x"
        ? { l: Math.min(f, e), r: Math.max(f, e), t: cross[0], b: cross[1] }
        : { t: Math.min(f, e), b: Math.max(f, e), l: cross[0], r: cross[1] };
    const row = others.filter(
      (o) => sameRow(o, cur, a) && hi(o, a) - lo(o, a) > 0,
    );
    const next =
      dir > 0
        ? row
            .filter((o) => lo(o, a) >= e - tol)
            .sort((x, y) => lo(x, a) - lo(y, a))[0]
        : row
            .filter((o) => hi(o, a) <= e + tol)
            .sort((x, y) => hi(y, a) - hi(x, a))[0];
    if (next) {
      for (const { p, q: qq, g } of adjacentGaps(row, a)) {
        const v = dir > 0 ? lo(next, a) - g : hi(next, a) + g;
        const diff = v - e;
        if (Math.abs(diff) > tol) continue;
        const score = Math.abs(diff) - tol; // 等間隔を優先
        if (score < bestScore - 0.01) {
          bestScore = score;
          best = { v, size: undefined, gap: { ref: [p, qq], g, next } };
        }
      }
    }
    const b = best as {
      v: number;
      size?: number;
      gap?: { ref: [Box, Box]; g: number; next: Box };
    } | null;
    return {
      v: b ? b.v : round(e),
      snapped: Boolean(b),
      size: b?.size,
      gap: b?.gap,
    };
  };
  const sx = axis("x");
  const sy = axis("y");
  const r: Box = {
    l: Math.min(fixed.x, sx.v),
    r: Math.max(fixed.x, sx.v),
    t: Math.min(fixed.y, sy.v),
    b: Math.max(fixed.y, sy.v),
  };
  const lines = [
    ...(sx.snapped && sx.size === undefined && !sx.gap
      ? alignLines(r, others, "x")
      : []),
    ...(sy.snapped && sy.size === undefined && !sy.gap
      ? alignLines(r, others, "y")
      : []),
  ];
  // 同じ幅／高さになった項目に、寸法の目印（両端付きの線＋数値）を付ける
  const gaps: GapMark[] = [];
  const OFF = 12;
  // 等間隔になったすき間の目印（基準のすき間と、いま作ったすき間）
  for (const [a, s] of [
    ["x", sx],
    ["y", sy],
  ] as const) {
    if (!s.gap) continue;
    const [p, q] = s.gap.ref;
    const mid = (u: Box, v: Box) =>
      (Math.max(crossLo(u, a), crossLo(v, a)) +
        Math.min(crossHi(u, a), crossHi(v, a))) /
      2;
    const seg = (from: number, to: number, c: number): GapMark =>
      a === "x"
        ? { x1: from, y1: c, x2: to, y2: c, size: Math.round(to - from) }
        : { x1: c, y1: from, x2: c, y2: to, size: Math.round(to - from) };
    gaps.push(seg(hi(p, a), lo(q, a), mid(p, q)));
    const n = s.gap.next;
    gaps.push(
      lo(n, a) >= hi(r, a)
        ? seg(hi(r, a), lo(n, a), mid(r, n))
        : seg(hi(n, a), lo(r, a), mid(r, n)),
    );
  }
  if (sx.size !== undefined) {
    const w = sx.size;
    for (const o of [r, ...others.filter((o) => Math.abs(o.r - o.l - w) < 0.5)])
      gaps.push({
        x1: o.l,
        y1: o.t - OFF,
        x2: o.r,
        y2: o.t - OFF,
        size: Math.round(w),
      });
  }
  if (sy.size !== undefined) {
    const h = sy.size;
    for (const o of [r, ...others.filter((o) => Math.abs(o.b - o.t - h) < 0.5)])
      gaps.push({
        x1: o.l - OFF,
        y1: o.t,
        x2: o.l - OFF,
        y2: o.b,
        size: Math.round(h),
      });
  }
  return { x: sx.v, y: sy.v, lines, gaps };
}
