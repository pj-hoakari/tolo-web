import { loginFlow } from "@/server/auth";
import { authMockingEnabled } from "@/server/auth/mocking";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  if (authMockingEnabled()) return new Response(null, { status: 404 });
  return loginFlow().startRegistration(
    request.headers.get("host") ?? "",
    (await params).tenantId,
    "/invitation/handoff",
  );
}
