import { authMockingEnabled } from "@/server/auth/mocking";
import { completeOnboarding } from "@/server/registration";

export function GET(request: Request) {
  if (authMockingEnabled()) return new Response(null, { status: 404 });
  return completeOnboarding(request);
}
