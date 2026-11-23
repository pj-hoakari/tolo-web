"use server";

import { getAccessToken, getViewer } from "@/server/auth";
import { authMockingEnabled } from "@/server/auth/mocking";
import { tokenScopes } from "@/server/auth/session";

export type EventNavigationAccess = {
  canEditGuideMap: boolean;
  canViewObservationDevices: boolean;
};

const noAccess: EventNavigationAccess = {
  canEditGuideMap: false,
  canViewObservationDevices: false,
};

export async function getEventNavigationAccess(
  eventId: string,
): Promise<EventNavigationAccess> {
  const viewer = await getViewer();
  if (viewer.type !== "staff") return noAccess;

  if (
    authMockingEnabled() &&
    process.env.NEXT_PUBLIC_API_MOCKING === "enabled"
  ) {
    return { canEditGuideMap: true, canViewObservationDevices: true };
  }

  if (typeof eventId !== "string" || !/^[0-9a-f]{16}$/.test(eventId)) {
    return noAccess;
  }

  try {
    const token = await getAccessToken({
      type: "event_access",
      eventId,
      client: "console",
    });
    const scopes = tokenScopes(token);
    const canRead = scopes.has("events.read");
    return {
      canEditGuideMap: canRead && scopes.has("events.manage"),
      canViewObservationDevices: canRead,
    };
  } catch {
    return noAccess;
  }
}
