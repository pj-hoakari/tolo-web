export const EVENT_TYPES = ["shortTerm", "longTerm"] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface ObservationSettings {
  historyWindowDays: number;
  eventType: EventType | null;
}
