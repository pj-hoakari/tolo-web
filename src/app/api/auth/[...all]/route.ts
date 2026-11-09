import { toNextJsHandler } from "better-auth/next-js";
import { loginFlow } from "@/server/auth";
import { getRealAuth } from "@/server/auth/betterAuth";
import { PROVIDER_ID } from "@/server/auth/login";
import { authMockingEnabled } from "@/server/auth/mocking";

export const { GET, POST } = toNextJsHandler(async (request: Request) => {
  if (authMockingEnabled()) return new Response(null, { status: 404 });
  if (new URL(request.url).pathname === `/api/auth/callback/${PROVIDER_ID}`) {
    const registration = await loginFlow().registrationCallback(request);
    if (registration) return registration;
  }
  return getRealAuth().auth.handler(request);
});
