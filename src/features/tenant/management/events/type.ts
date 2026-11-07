export const EVENT_STATUSES = [
  "draft",
  "open",
  "locked",
  "closed",
  "archived",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

// Backend: tolo-tenant-management/internal/tenant/domain/event.go
// Verified at 84e04e62d7fe8dfefed0504d73e7d983854997eb.
export const EVENT_STATUS_TRANSITIONS: Record<
  EventStatus,
  readonly EventStatus[]
> = {
  draft: ["open", "archived"],
  open: ["locked"],
  locked: ["open", "closed"],
  closed: ["open", "archived"],
  archived: ["closed"],
};

export interface TenantEvent {
  eventId: string;
  name: string;
  status: EventStatus;
}

export const ARCHIVABLE_STATUSES: ReadonlySet<EventStatus> = new Set([
  "draft",
  "closed",
]);

export const RESTORABLE_STATUSES: ReadonlySet<EventStatus> = new Set([
  "archived",
]);
