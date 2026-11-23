import "server-only";

import { getAccessToken } from "@/server/auth";
import { authMockingEnabled } from "@/server/auth/mocking";
import { tokenScopes } from "@/server/auth/session";

function fullMockingEnabled() {
  return (
    authMockingEnabled() && process.env.NEXT_PUBLIC_API_MOCKING === "enabled"
  );
}

// The event list calls this after requireStaff. Membership RPCs enforce their
// own permissions even when this link is available.
export async function canReadTenantMembers(): Promise<boolean> {
  if (fullMockingEnabled()) return true;
  try {
    const token = await getAccessToken({ type: "tenant_access" });
    return tokenScopes(token).has("tenant.read");
  } catch {
    return false;
  }
}

export type EventNavigationAccess = {
  canEditGuideMap: boolean;
  canViewObservationDevices: boolean;
};

export const noEventNavigationAccess: EventNavigationAccess = {
  canEditGuideMap: false,
  canViewObservationDevices: false,
};

// Called after requireStaff or checking the viewer's session type.
export async function readStaffEventNavigationAccess(
  eventId: string,
): Promise<EventNavigationAccess> {
  if (fullMockingEnabled()) {
    return { canEditGuideMap: true, canViewObservationDevices: true };
  }

  if (typeof eventId !== "string" || !/^[0-9a-f]{16}$/.test(eventId)) {
    return noEventNavigationAccess;
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
    return noEventNavigationAccess;
  }
}
