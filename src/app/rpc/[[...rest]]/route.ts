import { RPCHandler } from "@orpc/server/fetch";
import { SimpleCsrfProtectionHandlerPlugin } from "@orpc/server/plugins";
import { router } from "@/server/router";

const handler = new RPCHandler(router, {
  plugins: [new SimpleCsrfProtectionHandlerPlugin()],
});

async function handleRequest(request: Request): Promise<Response> {
  const { response } = await handler.handle(request, {
    prefix: "/rpc",
    context: {},
  });
  return response ?? new Response("Not found", { status: 404 });
}

export const GET = handleRequest;
export const POST = handleRequest;
