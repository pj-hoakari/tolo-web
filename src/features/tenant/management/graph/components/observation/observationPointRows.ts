import type { ObservationPoint } from "@/server/router";

/** 観測点ピッカーの1行分の表示情報 */
export type ObservationPointRow = {
  id: string;
  name?: string;
  /** 現在稼働中か（紐づけ済みだが切断済みの観測点は false） */
  online: boolean;
};

/**
 * 表示する観測点の行を組み立てる。
 * 表示順は 稼働中の観測点 → 紐づけ済みだが現在オフラインの観測点。
 */
export function buildObservationPointRows(
  linkedIds: readonly string[],
  available: readonly ObservationPoint[],
): ObservationPointRow[] {
  const aliveIds = new Set(available.map((p) => p.observationPointId));
  return [
    ...available.map((p) => ({
      id: p.observationPointId,
      name: p.name,
      online: true,
    })),
    ...linkedIds
      .filter((id) => !aliveIds.has(id))
      .map((id) => ({ id, online: false })),
  ];
}
