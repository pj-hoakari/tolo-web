type StorageIdentity =
  | { type: "anonymous" }
  | { type: "staff" | "machine"; userId: string };

/** Identity comes from the server session, never from a remembered browser key. */
export function createStaffStorageScope(
  tenantId: string,
  viewer: StorageIdentity,
) {
  return encodeURIComponent(
    JSON.stringify([
      tenantId,
      viewer.type,
      viewer.type === "anonymous" ? null : viewer.userId,
    ]),
  );
}

/** Legacy keys remain intact, but authenticated pages never read another owner. */
export function scopeStaffStorageKey(key: string, scope?: string) {
  return scope ? `tolo:staff:${scope}:${key}` : key;
}
