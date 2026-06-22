import type { AliveEdge } from "@/features/tenant/webrtc/type";
import type { AliveEdge as WireAliveEdge } from "@/server/router";

// id は `${tenantId}_${eventId}_${suffix}` 形式
export const SAMPLE_TENANT_ID = "test";
export const SAMPLE_EVENT_ID = "test";

export const sampleAliveEdgesWire: WireAliveEdge[] = [
  {
    id: `${SAMPLE_TENANT_ID}_${SAMPLE_EVENT_ID}_8c1f0e2a`,
    lastSeenAt: "2026-06-14T10:00:00.000Z",
  },
  {
    id: `${SAMPLE_TENANT_ID}_${SAMPLE_EVENT_ID}_3b9d77f4`,
    lastSeenAt: "2026-06-14T10:00:05.000Z",
  },
];

export const sampleAliveEdges: AliveEdge[] = sampleAliveEdgesWire.map(
  (edge) => ({
    id: edge.id,
    lastSeenAt: edge.lastSeenAt ? new Date(edge.lastSeenAt) : null,
  }),
);
