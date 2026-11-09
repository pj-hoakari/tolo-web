import { authMockingEnabled } from "@/server/auth/mocking";
import { completeInvitation } from "@/server/registration";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  if (authMockingEnabled()) return new Response(null, { status: 404 });
  return completeInvitation(request, (await params).tenantId);
}
