import { loginFlow } from "@/server/auth";
import { pendingInvitationToken } from "@/server/auth/invitation";
import { authMockingEnabled } from "@/server/auth/mocking";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  if (authMockingEnabled()) return new Response(null, { status: 404 });
  if (!(await pendingInvitationToken())) {
    return new Response(null, {
      status: 302,
      headers: { location: "/invitation/accept" },
    });
  }
  return loginFlow().startRegistration(
    request.headers.get("host") ?? "",
    (await params).tenantId,
    "/invitation/handoff",
  );
}
