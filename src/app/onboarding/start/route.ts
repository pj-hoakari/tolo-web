import { boundOnboarding, loginFlow } from "@/server/auth";
import { authMockingEnabled } from "@/server/auth/mocking";

export async function GET(request: Request) {
  if (authMockingEnabled()) return new Response(null, { status: 404 });
  const pending = await boundOnboarding();
  if (!pending) {
    return new Response(null, {
      status: 302,
      headers: { location: "/onboarding" },
    });
  }
  return loginFlow().startRegistration(
    request.headers.get("host") ?? "",
    pending.tenantId,
    "/onboarding/claim",
  );
}
