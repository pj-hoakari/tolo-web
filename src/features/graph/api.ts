import type { GraphData } from "@/features/tenant/management/graph/type";
import { PLACEHOLDER_GRAPH } from "./placeholderGraph";

/** グラフを特定するためのキー。tenant / guest のどちらからも同じ値で引く */
export type GraphKey = {
  tenantId: string;
  eventId: string;
};

/**
 * 会場グラフの取得。
 * API の仕様が未確定のため、いまは同梱のサンプル（PLACEHOLDER_GRAPH）を返す。
 * 呼び出し側は取得元（API / サンプル）を意識しない。
 * 呼び出しごとに複製して返し、編集状態が共有オブジェクトへ漏れないようにする。
 */
export async function fetchGraph(_key: GraphKey): Promise<GraphData> {
  return structuredClone(PLACEHOLDER_GRAPH);
}

/**
 * 会場グラフの保存。
 * TODO: API 送信に差し替え（仕様確定待ち）。いまはコンソールに出すだけ。
 */
export async function saveGraph(key: GraphKey, data: GraphData): Promise<void> {
  console.log("saveGraph", key, data);
}
