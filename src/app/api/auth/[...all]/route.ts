import { toNextJsHandler } from "better-auth/next-js";
import { getRealAuth } from "@/server/auth/betterAuth";
import { authMockingEnabled } from "@/server/auth/mocking";

export const { GET, POST } = toNextJsHandler(async (request: Request) =>
  authMockingEnabled()
    ? new Response(null, { status: 404 })
    : getRealAuth().auth.handler(request),
);
