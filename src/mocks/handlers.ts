import { RPCHandler } from "@orpc/server/fetch";
import { http, passthrough, type RequestHandler } from "msw";
import type { EdgeDevice } from "@/server/router";
import { sampleEdgeDevicesWire } from "./fixtures/edges";
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

/** observation.listEdgeDevices が任意のエッジ端末一覧を返す handler 群 */
export function edgesHandlers(devices: EdgeDevice[]): RequestHandler[] {
  return createOrpcHandlers({ devices });
}

/** observation.listEdgeDevices が失敗する handler 群 */
export function edgesErrorHandlers(): RequestHandler[] {
  return createOrpcHandlers({ devicesError: true });
}

/** 既定: サンプルのエッジ端末一覧を返す */
export const handlers: RequestHandler[] = edgesHandlers(sampleEdgeDevicesWire);
