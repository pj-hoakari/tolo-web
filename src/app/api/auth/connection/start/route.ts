import { NextResponse } from "next/server";
import { getViewer, requestTenantId } from "@/server/auth";
import {
  connectionResultPath,
  getConnectionAuth,
} from "@/server/auth/connection";
import { withEventLifecycle } from "@/server/auth/eventLifecycle";
import { sameHostPath } from "@/server/auth/login";
import { delegatedPageCameras } from "@/server/cameraDelegation";
import { requireApprovableEvent } from "@/server/eventStatus";

export const dynamic = "force-dynamic";

const PUBLIC_ID = /^[0-9a-f]{16}$/;

function backTo(request: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), 302);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId") ?? "";
  const pageEdgeDeviceId = url.searchParams.get("pageEdgeDeviceId") ?? "";
  const returnPath = sameHostPath(url.searchParams.get("return") ?? "/");
  if (
    !returnPath ||
    !eventId ||
    !PUBLIC_ID.test(eventId) ||
    !PUBLIC_ID.test(pageEdgeDeviceId)
  ) {
    return backTo(request, "/auth/error?error=connection_request_invalid");
  }

  const tenantId = await requestTenantId();
  const viewer = await getViewer();
  if (!tenantId || viewer.type !== "staff" || viewer.tenantId !== tenantId) {
    const returnTo = `${url.pathname}${url.search}`;
    return backTo(
      request,
      `/auth/login?return=${encodeURIComponent(returnTo)}`,
    );
  }

  try {
    return await withEventLifecycle(eventId, async () => {
      await requireApprovableEvent(eventId);
      const cameraIds = await delegatedPageCameras(eventId, pageEdgeDeviceId);
      if (!cameraIds) {
        return backTo(request, "/auth/error?error=connection_page_not_found");
      }
      const location = await getConnectionAuth().start({
        tenantId,
        eventId,
        pageEdgeDeviceId,
        cameraIds,
        staffSub: viewer.userId,
        host: request.headers.get("host") ?? "",
        returnPath,
      });
      return NextResponse.redirect(location, 302);
    });
  } catch (error) {
    console.error("failed to start the camera connection authorization", error);
    return backTo(request, connectionResultPath(returnPath, "failed"));
  }
}
