import { EVENT_STATUSES, type EventStatus } from "./type";

export type EventListFilters = {
  query: string;
  selectedStatus: EventStatus | "all";
  includeArchived: boolean;
};

export function readEventListFilters(
  params: URLSearchParams,
): EventListFilters {
  const status = params.get("status");
  const selectedStatus =
    EVENT_STATUSES.find((value) => value === status) ?? "all";
  return {
    query: params.get("q") ?? "",
    selectedStatus,
    includeArchived:
      params.get("archived") === "1" || selectedStatus === "archived",
  };
}

export function eventListSearch(
  filters: EventListFilters,
  params = new URLSearchParams(),
): string {
  if (filters.query) params.set("q", filters.query);
  else params.delete("q");
  if (filters.selectedStatus !== "all")
    params.set("status", filters.selectedStatus);
  else params.delete("status");
  if (filters.includeArchived || filters.selectedStatus === "archived")
    params.set("archived", "1");
  else params.delete("archived");
  return params.toString();
}

export type EventListPosition = { search: string; y: number };
export const listStorageKey = (tenantId: string) =>
  `tolo:event-list:${tenantId}`;

export function readListPosition(value: unknown): EventListPosition | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("search" in value) ||
    !("y" in value)
  )
    return null;
  if (
    typeof value.search !== "string" ||
    typeof value.y !== "number" ||
    !Number.isFinite(value.y) ||
    value.y < 0
  )
    return null;
  // Store filter values only: a saved value can never select another host or route.
  return {
    search: eventListSearch(
      readEventListFilters(new URLSearchParams(value.search)),
    ),
    y: value.y,
  };
}
