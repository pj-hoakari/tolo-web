import { getRealAuth } from "@/server/auth/betterAuth";
import { authMockingEnabled } from "@/server/auth/mocking";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (authMockingEnabled()) return new Response(null, { status: 404 });
  const url = new URL(request.url);
  return getRealAuth().auth.api.completeMachineSession({
    body: {
      code: url.searchParams.get("code") ?? "",
      host: request.headers.get("host") ?? "",
    },
    headers: request.headers,
    asResponse: true,
  });
}
