"use server";

import { getViewer } from "@/server/auth";
import {
  type EventNavigationAccess,
  noEventNavigationAccess,
  readStaffEventNavigationAccess,
} from "../headerAccess";

export type { EventNavigationAccess } from "../headerAccess";

export async function getEventNavigationAccess(
  eventId: string,
): Promise<EventNavigationAccess> {
  const viewer = await getViewer();
  if (viewer.type !== "staff") return noEventNavigationAccess;
  return readStaffEventNavigationAccess(eventId);
}
