import { RPCHandler } from "@orpc/server/fetch";
import { router } from "@/server/router";

const handler = new RPCHandler(router);

async function handleRequest(request: Request): Promise<Response> {
  const { response } = await handler.handle(request, {
    prefix: "/rpc",
    context: {},
  });
  return response ?? new Response("Not found", { status: 404 });
}

export const GET = handleRequest;
export const POST = handleRequest;
