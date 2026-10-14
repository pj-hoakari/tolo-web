export type EventStatus = "draft" | "open" | "locked" | "closed" | "archived";

export interface TenantEvent {
  eventId: string;
  name: string;
  status: EventStatus;
}

export const ARCHIVABLE_STATUSES: ReadonlySet<EventStatus> = new Set([
  "draft",
  "closed",
]);
