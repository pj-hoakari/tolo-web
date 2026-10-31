import { loginFlow } from "@/server/auth";
import { authMockingEnabled } from "@/server/auth/mocking";

export function GET(request: Request) {
  if (authMockingEnabled()) return new Response(null, { status: 404 });
  return loginFlow().handoff(request);
}
