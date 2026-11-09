import { getViewer, loginFlow } from "@/server/auth";
import { authMockingEnabled } from "@/server/auth/mocking";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  if (authMockingEnabled()) return new Response(null, { status: 404 });
  if ((await getViewer()).type === "machine") {
    return new Response(null, { status: 403 });
  }
  return loginFlow().start(request, (await params).tenantId);
}
