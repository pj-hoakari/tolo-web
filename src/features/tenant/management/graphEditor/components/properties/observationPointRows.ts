import type { AliveEdge } from "@/features/tenant/webrtc/type";

/** 観測点ピッカーの1行分の表示情報 */
export type ObservationPointRow = {
  id: string;
  /** 現在接続中か（紐づけ済みだが切断済みの観測点は false） */
  online: boolean;
};

/**
 * 表示する観測点の行を組み立てる。
 * 表示順は 接続中の観測点 → 紐づけ済みだが現在オフラインの観測点。
 */
export function buildObservationPointRows(
  linkedIds: readonly string[],
  available: readonly AliveEdge[],
): ObservationPointRow[] {
  const aliveIds = new Set(available.map((e) => e.id));
  return [
    ...available.map((e) => ({ id: e.id, online: true })),
    ...linkedIds
      .filter((id) => !aliveIds.has(id))
      .map((id) => ({ id, online: false })),
  ];
}
