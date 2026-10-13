import type { GraphData } from "@/features/tenant/management/graph/type";
import { PLACEHOLDER_GRAPH } from "./placeholderGraph";

/** グラフを特定するためのキー。tenant / guest のどちらからも同じ値で引く */
export type GraphKey = {
  tenantId: string;
  eventId: string;
};

/**
 * グラフの取得。
 * API の仕様が未確定のため、いまは同梱のサンプル（PLACEHOLDER_GRAPH）を返す。
 * 呼び出し側は取得元（API / サンプル）を意識しない。
 * 呼び出しごとに複製して返し、編集状態が共有オブジェクトへ漏れないようにする。
 */
export async function fetchGraph(_key: GraphKey): Promise<GraphData> {
  return structuredClone(PLACEHOLDER_GRAPH);
}

/**
 * グラフの保存。
 * TODO: API 送信に差し替え（仕様確定待ち）。いまはコンソールに出すだけ。
 */
export async function saveGraph(key: GraphKey, data: GraphData): Promise<void> {
  console.log("saveGraph", key, data);
}

export type GraphValidationTarget = { type: "node" | "edge"; id: string };

const TARGET_TYPES: Record<string, GraphValidationTarget["type"]> = {
  node: "node",
  point: "node",
  group: "node",
  edge: "edge",
};

export function validationTarget(
  message: string,
): GraphValidationTarget | null {
  const match = /\b(node|point|group|edge) "([^"]+)"/.exec(message);
  return match ? { type: TARGET_TYPES[match[1]], id: match[2] } : null;
}

export class GraphValidationError extends Error {
  readonly target = validationTarget(this.message);

  constructor(message: string) {
    super(message);
    this.name = "GraphValidationError";
  }
}
