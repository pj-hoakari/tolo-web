import { getRealAuth } from "./betterAuth";

const EVENT_LIFECYCLE_PREFIX = "event-lifecycle:";

export function eventLifecycleLockKey(eventId: string): string {
  return `${EVENT_LIFECYCLE_PREFIX}${eventId}`;
}

/**
 * Serializes camera registration, Device Authorization approval, machine
 * session setup, and event lifecycle changes. IdP does not know event state;
 * the BFF remains the only caller of the approval API.
 */
export async function withEventLifecycle<T>(
  eventId: string,
  task: () => Promise<T>,
): Promise<T> {
  if (!process.env.AUTH_DATABASE_URL) return task();
  return getRealAuth().lock(eventLifecycleLockKey(eventId), task);
}
