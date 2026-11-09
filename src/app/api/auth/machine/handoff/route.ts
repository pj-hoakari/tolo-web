import { rootOrigin } from "@/lib/control/tenant";
import { getRealAuth } from "@/server/auth/betterAuth";
import { withEventLifecycle } from "@/server/auth/eventLifecycle";
import { pendingMachineHandoffEvent } from "@/server/auth/machineHandoffLookup";
import { authMockingEnabled } from "@/server/auth/mocking";
import { requireApprovableEvent } from "@/server/eventStatus";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (authMockingEnabled()) return new Response(null, { status: 404 });
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  try {
    const eventId = await pendingMachineHandoffEvent(code);
    if (!eventId) {
      return Response.redirect(
        `${rootOrigin()}/auth/error?error=machine_handoff_invalid`,
        302,
      );
    }
    return await withEventLifecycle(eventId, async () => {
      await requireApprovableEvent(eventId);
      return getRealAuth().auth.api.completeMachineSession({
        body: {
          code,
          host: request.headers.get("host") ?? "",
        },
        headers: request.headers,
        asResponse: true,
      });
    });
  } catch (error) {
    console.error(
      "failed to complete the observation page machine handoff",
      error,
    );
    return Response.redirect(
      `${rootOrigin()}/auth/error?error=machine_handoff_invalid`,
      302,
    );
  }
}
