export function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * 1 次元の並びを、並び順と最小間隔を保ったまま各メンバーの希望位置へ
 * できるだけ近づけて配置する。重なるメンバーは塊として希望位置の平均へ
 * まとめるため、共通の接続先を希望するメンバーはその中心を挟んで
 * 対称に並ぶ。
 */
export function placeLine(
  ids: string[],
  sizeOfId: (id: string) => number,
  desiredOf: (id: string) => number,
  gap: number,
): Map<string, number> {
  type Cluster = { ids: string[]; offsets: number[]; base: number };
  const separation = (a: string, b: string) =>
    (sizeOfId(a) + sizeOfId(b)) / 2 + gap;
  const optimalBase = (cluster: Pick<Cluster, "ids" | "offsets">): number =>
    average(cluster.ids.map((id, i) => desiredOf(id) - cluster.offsets[i]));

  const clusters: Cluster[] = [];
  for (const id of ids) {
    let cluster: Cluster = { ids: [id], offsets: [0], base: desiredOf(id) };
    while (clusters.length > 0) {
      const prev = clusters[clusters.length - 1];
      const prevLastId = prev.ids[prev.ids.length - 1];
      const prevLastCenter = prev.base + prev.offsets[prev.offsets.length - 1];
      if (
        cluster.base >=
        prevLastCenter + separation(prevLastId, cluster.ids[0])
      ) {
        break;
      }
      // 前の塊と重なるので統合し、希望位置の平均へ置き直してさらに遡って確認
      clusters.pop();
      const shift =
        prev.offsets[prev.offsets.length - 1] +
        separation(prevLastId, cluster.ids[0]);
      const merged = {
        ids: [...prev.ids, ...cluster.ids],
        offsets: [...prev.offsets, ...cluster.offsets.map((o) => o + shift)],
      };
      cluster = { ...merged, base: optimalBase(merged) };
    }
    clusters.push(cluster);
  }

  const result = new Map<string, number>();
  for (const cluster of clusters) {
    for (let i = 0; i < cluster.ids.length; i += 1) {
      result.set(cluster.ids[i], cluster.base + cluster.offsets[i]);
    }
  }
  return result;
}
