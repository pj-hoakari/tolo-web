import { loginFlow } from "@/server/auth";
import { authMockingEnabled } from "@/server/auth/mocking";

export function POST(request: Request) {
  if (authMockingEnabled()) return new Response(null, { status: 404 });
  return loginFlow().logout(request);
}
