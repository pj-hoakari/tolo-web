import { NextResponse } from "next/server";
import { getViewer, requestTenantId } from "@/server/auth";
import { getConnectionAuth } from "@/server/auth/connection";
import { withEventLifecycle } from "@/server/auth/eventLifecycle";
import { sameHostPath } from "@/server/auth/login";
import {
  getMachineAuth,
  type MachineSessionResult,
  machineResultPath,
} from "@/server/auth/machine";
import { delegatedPageCameras } from "@/server/cameraDelegation";
import { requireApprovableEvent } from "@/server/eventStatus";

export const dynamic = "force-dynamic";

const PUBLIC_ID = /^[0-9a-f]{16}$/;

function backTo(request: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), 302);
}

function connectionNotice(value: string | null): MachineSessionResult | null {
  return value === "login_required" || value === "failed" ? value : null;
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
    return backTo(request, "/auth/error?error=machine_request_invalid");
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
        return backTo(request, "/auth/error?error=machine_page_not_found");
      }
      const connection = getConnectionAuth();
      const authorized = await connection.hasAuthorization({
        tenantId,
        eventId,
        pageEdgeDeviceId,
      });
      if (!authorized) {
        const failed = connectionNotice(
          url.searchParams.get("cameraConnection"),
        );
        if (failed)
          return backTo(request, machineResultPath(returnPath, failed));
        const returnTo = `${url.pathname}${url.search}`;
        const query = new URLSearchParams({
          eventId,
          pageEdgeDeviceId,
          return: returnTo,
        });
        return backTo(request, `/api/auth/connection/start?${query}`);
      }

      const started = await getMachineAuth().start({
        tenantId,
        eventId,
        pageEdgeDeviceId,
        staffSub: viewer.userId,
        host: request.headers.get("host") ?? url.host,
        returnPath,
        staffSessionId: viewer.sessionId,
      });
      const response = NextResponse.redirect(started.location, 302);
      response.cookies.set(
        started.binding.name,
        started.binding.value,
        started.binding.attributes,
      );
      return response;
    });
  } catch (error) {
    console.error(
      "failed to start the observation page machine session",
      error,
    );
    return backTo(request, machineResultPath(returnPath, "failed"));
  }
}
