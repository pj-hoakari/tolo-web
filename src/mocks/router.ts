import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import type { EdgeDevice } from "@/server/router";
import { sampleEdgeDevicesWire } from "./fixtures/edges";

export type MockRouterOverrides = {
  /** observation.listEdgeDevices が返すエッジ端末一覧（未指定なら sampleEdgeDevicesWire） */
  devices?: EdgeDevice[];
  /** observation.listEdgeDevices を失敗させる（status: error の確認用） */
  devicesError?: boolean;
  saveGraphError?: string;
};

/**
 * 本物の `@/server/router` と同じ shape のモック router。
 * server-only な `@/server/signaling`（Connect-RPC クライアント）には依存しないので、
 * ブラウザ（Storybook / next dev）でも node（Vitest）でも動く。
 * RPCHandler に載せて MSW から `/rpc` を傍受するために使う。
 */
export function createMockRouter(overrides: MockRouterOverrides = {}) {
  const {
    devices = sampleEdgeDevicesWire,
    devicesError = false,
    saveGraphError,
  } = overrides;

  return {
    graph: {
      saveGraph: os
        .input(z.object({ eventId: z.string().min(1), document: z.unknown() }))
        .handler(async (): Promise<void> => {
          if (saveGraphError !== undefined) {
            throw new ORPCError("BAD_REQUEST", { message: saveGraphError });
          }
        }),
    },
    observation: {
      listEdgeDevices: os
        .input(z.object({ eventId: z.string().min(1) }))
        .handler(async (): Promise<{ devices: EdgeDevice[] }> => {
          if (devicesError) {
            throw new ORPCError("INTERNAL_SERVER_ERROR", {
              message: "エッジ一覧の取得に失敗しました（モック）",
            });
          }
          return { devices };
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
