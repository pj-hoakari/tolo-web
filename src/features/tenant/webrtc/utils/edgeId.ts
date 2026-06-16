const EDGE_ID_STORAGE_PREFIX = "tolo-web:webrtc:edge-id";

function storageKey(tenantId: string, eventId: string): string {
  return `${EDGE_ID_STORAGE_PREFIX}:${tenantId}:${eventId}`;
}

export function edgeIdPrefix(tenantId: string, eventId: string): string {
  return `${tenantId}_${eventId}_`;
}

export function getOrCreateEdgeId(tenantId: string, eventId: string): string {
  const key = storageKey(tenantId, eventId);
  const existing = localStorage.getItem(key);
  if (existing) {
    return existing;
  }
  const id = `${edgeIdPrefix(tenantId, eventId)}${crypto.randomUUID()}`;
  localStorage.setItem(key, id);
  return id;
}
