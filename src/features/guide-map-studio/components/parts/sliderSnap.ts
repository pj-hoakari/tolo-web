// スライダーの「切りのいい数字で少し止まる」動き。
// つまみをドラッグしているとき、切りのいい数字（目盛り）の近くに来たら、その数字に吸い付ける。
// キーボードの矢印で 1 刻みずつ動かすときは吸い付けない（目盛りの近くから抜け出せなくなるため）

// 目盛りの間隔の候補（1・2・5 の並び）
const NICE = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];

/** 範囲に 3〜8 本くらい並ぶ間隔で、切りのいい目盛りを作る（両端は含めない） */
export function niceSnapPoints(min: number, max: number): number[] {
  const span = max - min;
  if (span <= 0) return [];
  const step = NICE.find((s) => span / s <= 8) ?? NICE[NICE.length - 1];
  const points: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step)
    if (v > min && v < max) points.push(v);
  return points;
}

/** 吸い付く幅：範囲の 2.5%（少なくとも刻みの 1.5 倍。刻みが粗いと吸い付きが分からないため） */
export const snapRadius = (min: number, max: number, step = 1) =>
  Math.max(step * 1.5, (max - min) * 0.025);

/** 目盛りの近く（radius 以内）なら、その目盛りの値にする */
export function snapToPoints(
  value: number,
  points: readonly number[],
  radius: number,
): number {
  let best = value;
  let bestDist = radius;
  for (const p of points) {
    const d = Math.abs(value - p);
    if (d <= bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}
