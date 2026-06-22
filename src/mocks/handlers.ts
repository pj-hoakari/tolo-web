import { RPCHandler } from "@orpc/server/fetch";
import { http, passthrough, type RequestHandler } from "msw";
import type { AliveEdge } from "@/server/router";
import { sampleAliveEdgesWire } from "./fixtures/edges";
import { createMockRouter, type MockRouterOverrides } from "./router";

function orpcHandler(
  router: ReturnType<typeof createMockRouter>,
): RequestHandler {
  const handler = new RPCHandler(router);
  return http.all("*/rpc/*", async ({ request }) => {
    const { matched, response } = await handler.handle(request, {
      prefix: "/rpc",
      context: {},
    });
    if (matched && response) {
      return response;
    }
    return passthrough();
  });
}

/** 任意のデータ/エラーで `/rpc` をモックする handler 群 */
export function createOrpcHandlers(
  overrides?: MockRouterOverrides,
): RequestHandler[] {
  return [orpcHandler(createMockRouter(overrides))];
}

/** edges.listAlive が任意の edge 一覧を返す handler 群 */
export function edgesHandlers(edges: AliveEdge[]): RequestHandler[] {
  return createOrpcHandlers({ edges });
}

/** edges.listAlive が失敗する handler 群 */
export function edgesErrorHandlers(): RequestHandler[] {
  return createOrpcHandlers({ edgesError: true });
}

/** 既定: サンプルの edge 一覧を返す */
export const handlers: RequestHandler[] = edgesHandlers(sampleAliveEdgesWire);
