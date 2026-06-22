import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import type { AliveEdge } from "@/server/router";
import { sampleAliveEdgesWire } from "./fixtures/edges";

export type MockRouterOverrides = {
  /** edges.listAlive が返す edge 一覧（未指定なら sampleAliveEdgesWire） */
  edges?: AliveEdge[];
  /** edges.listAlive を失敗させる（status: error の確認用） */
  edgesError?: boolean;
};

/**
 * 本物の `@/server/router` と同じ shape のモック router。
 * server-only な `@/server/signaling`（Connect-RPC クライアント）には依存しないので、
 * ブラウザ（Storybook / next dev）でも node（Vitest）でも動く。
 * RPCHandler に載せて MSW から `/rpc` を傍受するために使う。
 */
export function createMockRouter(overrides: MockRouterOverrides = {}) {
  const { edges = sampleAliveEdgesWire, edgesError = false } = overrides;

  return {
    edges: {
      listAlive: os.handler(async (): Promise<{ edges: AliveEdge[] }> => {
        if (edgesError) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "エッジ一覧の取得に失敗しました（モック）",
          });
        }
        return { edges };
      }),
    },
    signaling: {
      // WebRTC はスコープ外。呼ばれてもエラーにならないよう、ダミーの sessionId を返す。
      requestConnection: os
        .input(z.object({ edgeId: z.string().min(1) }))
        .handler(
          async ({ input }): Promise<{ sessionId: string }> => ({
            sessionId: `mock-session_${input.edgeId}`,
          }),
        ),
    },
  };
}
