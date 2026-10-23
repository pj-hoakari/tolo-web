import {
  type Timestamp,
  timestampDate,
  timestampFromDate,
} from "@bufbuild/protobuf/wkt";
import { type Client, Code, ConnectError } from "@connectrpc/connect";
import { ORPCError, os } from "@orpc/server";
import type { SignalingService } from "@pj-hoakari/tolo-edge-bridge-client-es/tolo/edgebridge/v1/signaling_pb";
import {
  ElementKind,
  type GraphViolations,
  GraphViolationsSchema,
  ViolationKind,
} from "@pj-hoakari/tolo-graph-authoring-client-es/tolo/graph/v1/graph_pb";
import {
  CrowdLevel,
  GuestComponent,
} from "@pj-hoakari/tolo-guest-client-es/tolo/guest/v1/guest_pb";
import {
  MeasurementSource,
  type EdgeDevice as ProtoEdgeDevice,
} from "@pj-hoakari/tolo-observation-client-es/tolo/observation/v1/observation_pb";
import {
  type Event,
  EventStatus as ProtoEventStatus,
} from "@pj-hoakari/tolo-tenant-management-connect-es/tolo/tenant/v1/tenant_pb";
import { z } from "zod";
import {
  type GraphViolation,
  graphDataSchema,
} from "@/features/graph/graphDataSchema";
import type { GuestPageComponent } from "@/features/guest/pageComponents";
import type {
  EventStatus,
  TenantEvent,
} from "@/features/tenant/management/events/type";
import type { GraphData } from "@/features/tenant/management/graph/type";
import {
  registeredEdgeDeviceWire,
  sampleEdgeDevicesWire,
} from "@/mocks/fixtures/edges";
import { graphAuthoringClient } from "./graphAuthoring";
import { fromGraphDocument, toGraphDocument } from "./graphDocument";
import { guestPageClient } from "./guest";
import { issueRegistrationToken } from "./idp";
import {
  consoleEdgeDeviceClient,
  edgeEdgeDeviceClient,
  edgeMeasurementIngestClient,
} from "./observation";
import { consoleSignalingClient, edgeSignalingClient } from "./signaling";
import {
  tenantManagementClient,
  tenantRegistrationClient,
} from "./tenantManagement";

const publicId = z.string().regex(/^[0-9a-f]{16}$/);

const edgeDeviceInput = z.object({
  eventId: z.string().min(1),
  edgeDeviceId: publicId,
});

export interface ObservationPoint {
  observationPointId: string;
  name: string;
}

export interface EdgeDevice {
  edgeDeviceId: string;
  name: string;
  online: boolean;
  lastHeartbeatAt: string | null;
  observationPoints: ObservationPoint[];
}

export interface RegisteredEdgeDevice {
  device: EdgeDevice;
  observationPagePath: string;
}

function toEdgeDevice(d: ProtoEdgeDevice): EdgeDevice {
  return {
    edgeDeviceId: d.edgeDeviceId,
    name: d.name,
    online: d.online,
    lastHeartbeatAt: d.lastHeartbeatAt
      ? timestampDate(d.lastHeartbeatAt).toISOString()
      : null,
    observationPoints: d.observationPoints.map((p) => ({
      observationPointId: p.observationPointId,
      name: p.name,
    })),
  };
}

async function listEdgeDevices(eventId: string): Promise<EdgeDevice[]> {
  const res = await consoleEdgeDeviceClient.listEdgeDevices({ eventId });
  return res.devices.map(toEdgeDevice);
}

function observationMocking(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.OBSERVATION_API_MOCKING === "enabled"
  );
}

const EVENT_STATUSES: Partial<Record<ProtoEventStatus, EventStatus>> = {
  [ProtoEventStatus.DRAFT]: "draft",
  [ProtoEventStatus.OPEN]: "open",
  [ProtoEventStatus.LOCKED]: "locked",
  [ProtoEventStatus.CLOSED]: "closed",
  [ProtoEventStatus.ARCHIVED]: "archived",
};

function toTenantEvent(event: Event | undefined): TenantEvent {
  const status = event && EVENT_STATUSES[event.status];
  if (!event || !status) {
    throw new Error(
      `unexpected event from tenant-management: ${event?.status}`,
    );
  }
  return { eventId: event.eventId, name: event.name, status };
}

const ELEMENT_KINDS: Partial<
  Record<ElementKind, GraphViolation["elementKind"]>
> = {
  [ElementKind.NODE]: "node",
  [ElementKind.GROUP]: "group",
  [ElementKind.EDGE]: "edge",
};

function toGraphViolations({ violations }: GraphViolations): GraphViolation[] {
  return violations.map((v) => ({
    kind: ViolationKind[v.kind] ?? "UNSPECIFIED",
    elementKind: ELEMENT_KINDS[v.elementKind] ?? null,
    elementId: v.elementId,
    relatedIds: v.relatedIds,
  }));
}

const ORPC_ERROR_CODES: Partial<Record<Code, string>> = {
  [Code.InvalidArgument]: "BAD_REQUEST",
  [Code.FailedPrecondition]: "PRECONDITION_FAILED",
  [Code.NotFound]: "NOT_FOUND",
  [Code.AlreadyExists]: "CONFLICT",
};

function toORPCError(err: unknown): unknown {
  if (!(err instanceof ConnectError)) return err;
  const code = ORPC_ERROR_CODES[err.code];
  return code ? new ORPCError(code) : err;
}

export type GuestCrowdLevel = "low" | "mid" | "high";

export interface GuestCrowd {
  id: string;
  name: string;
  level: GuestCrowdLevel;
  danger: boolean;
}

export interface GuestCrowdSnapshot {
  takenAt: string | null;
  crowd: GuestCrowd[];
}

export interface GuestQueueGate {
  pointId: string;
  name: string;
  recommended: boolean;
}

export interface GuestQueue {
  queueId: string;
  name: string;
  waitTimeMinutes: number;
  gates: GuestQueueGate[];
}

export interface GuestMessage {
  messageId: string;
  body: string;
  sentAt: string | null;
}

const GUEST_PAGE_COMPONENTS: Partial<
  Record<GuestComponent, GuestPageComponent>
> = {
  [GuestComponent.CROWD]: "crowd",
  [GuestComponent.QUEUES]: "queues",
  [GuestComponent.STAFF_MESSAGES]: "staffMessages",
};

const GUEST_CROWD_LEVELS: Partial<Record<CrowdLevel, GuestCrowdLevel>> = {
  [CrowdLevel.LOW]: "low",
  [CrowdLevel.MID]: "mid",
  [CrowdLevel.HIGH]: "high",
};

function toISOString(timestamp: Timestamp | undefined): string | null {
  return timestamp ? timestampDate(timestamp).toISOString() : null;
}

const guestContentInput = z.object({
  eventId: z.string().min(1),
  language: z.string(),
});

export interface FirestoreToken {
  customToken: string;
  expiresAt: Date;
}

async function issueFirestoreToken(
  client: Client<typeof SignalingService>,
): Promise<FirestoreToken> {
  const res = await client.issueFirestoreToken({});
  if (!res.expiresAt) {
    throw new Error("IssueFirestoreToken returned no expires_at");
  }
  return {
    customToken: res.firebaseCustomToken,
    expiresAt: timestampDate(res.expiresAt),
  };
}

// フロント ↔ Next.js バックエンド間の oRPC ルータ。
// tolo-edge-bridge への Connect-RPC はこの層だけが叩く。
export const router = {
  graph: {
    getGraph: os
      .input(z.object({ eventId: z.string().min(1) }))
      .handler(async ({ input }): Promise<GraphData> => {
        try {
          const res = await graphAuthoringClient.getGraph(input);
          return res.document
            ? fromGraphDocument(res.document)
            : { nodes: [], edges: [] };
        } catch (err) {
          if (err instanceof ConnectError && err.code === Code.NotFound) {
            return { nodes: [], edges: [] };
          }
          throw err;
        }
      }),
    saveGraph: os
      .input(z.object({ eventId: z.string().min(1), graph: graphDataSchema }))
      .handler(async ({ input }): Promise<void> => {
        try {
          await graphAuthoringClient.saveGraph({
            eventId: input.eventId,
            document: toGraphDocument(input.graph),
          });
        } catch (err) {
          if (
            err instanceof ConnectError &&
            err.code === Code.InvalidArgument
          ) {
            throw new ORPCError("BAD_REQUEST", {
              data: {
                violations: err
                  .findDetails(GraphViolationsSchema)
                  .flatMap(toGraphViolations),
              },
            });
          }
          throw toORPCError(err);
        }
      }),
  },
  tenant: {
    register: os
      .input(
        z.object({
          name: z.string().trim().min(1),
          subdomain: z.string().trim().min(1),
          ownerEmail: z.email(),
        }),
      )
      .handler(
        async ({ input }): Promise<{ tenantId: string; subdomain: string }> => {
          try {
            const started =
              await tenantRegistrationClient.startTenantRegistration({
                name: input.name,
                contractPlan: "standard",
              });
            if (!started.tenant) {
              throw new Error("StartTenantRegistration returned no tenant");
            }
            const token = await issueRegistrationToken(input.ownerEmail);
            const claimed = await tenantRegistrationClient.claimTenantOwnership(
              {
                tenantId: started.tenant.tenantId,
                ownershipClaimToken: started.ownershipClaimToken,
                subdomain: input.subdomain,
              },
              { headers: { Authorization: `Bearer ${token}` } },
            );
            if (!claimed.tenant) {
              throw new Error("ClaimTenantOwnership returned no tenant");
            }
            return {
              tenantId: claimed.tenant.tenantId,
              subdomain: claimed.tenant.subdomain,
            };
          } catch (err) {
            throw toORPCError(err);
          }
        },
      ),
    listEvents: os
      .input(
        z.object({
          tenantId: publicId,
          includeArchived: z.boolean().default(false),
        }),
      )
      .handler(async ({ input }): Promise<{ events: TenantEvent[] }> => {
        try {
          const res = await tenantManagementClient.listEvents(input);
          return { events: res.events.map(toTenantEvent) };
        } catch (err) {
          throw toORPCError(err);
        }
      }),
    createEvent: os
      .input(z.object({ tenantId: publicId, name: z.string().trim().min(1) }))
      .handler(async ({ input }): Promise<TenantEvent> => {
        try {
          const res = await tenantManagementClient.createEvent(input);
          return toTenantEvent(res.event);
        } catch (err) {
          throw toORPCError(err);
        }
      }),
    archiveEvent: os
      .input(z.object({ eventId: publicId }))
      .handler(async ({ input }): Promise<TenantEvent> => {
        try {
          const res = await tenantManagementClient.transitionEventStatus({
            eventId: input.eventId,
            to: ProtoEventStatus.ARCHIVED,
          });
          return toTenantEvent(res.event);
        } catch (err) {
          throw toORPCError(err);
        }
      }),
    restoreEvent: os
      .input(z.object({ eventId: publicId }))
      .handler(async ({ input }): Promise<TenantEvent> => {
        try {
          const res = await tenantManagementClient.transitionEventStatus({
            eventId: input.eventId,
            to: ProtoEventStatus.CLOSED,
          });
          return toTenantEvent(res.event);
        } catch (err) {
          throw toORPCError(err);
        }
      }),
  },
  guest: {
    openGuestPage: os
      .input(
        z.object({
          eventId: z.string().min(1),
          qrLocationId: z.string(),
          sessionId: z.string(),
        }),
      )
      .handler(
        async ({ input }): Promise<{ components: GuestPageComponent[] }> => {
          try {
            const res = await guestPageClient.openGuestPage(input);
            return {
              components: res.components.flatMap(
                (c) => GUEST_PAGE_COMPONENTS[c] ?? [],
              ),
            };
          } catch (err) {
            throw toORPCError(err);
          }
        },
      ),
    getCrowd: os
      .input(guestContentInput)
      .handler(async ({ input }): Promise<GuestCrowdSnapshot> => {
        try {
          const res = await guestPageClient.getCrowd(input);
          return {
            takenAt: toISOString(res.takenAt),
            crowd: res.crowd.flatMap((c) => {
              const level = GUEST_CROWD_LEVELS[c.level];
              if (!level || !c.target.case) return [];
              return [
                {
                  id: `${c.target.case}:${c.target.value}`,
                  name: c.displayName,
                  level,
                  danger: c.danger,
                },
              ];
            }),
          };
        } catch (err) {
          throw toORPCError(err);
        }
      }),
    getQueues: os
      .input(guestContentInput)
      .handler(async ({ input }): Promise<{ queues: GuestQueue[] }> => {
        try {
          const res = await guestPageClient.getQueues(input);
          return {
            queues: res.queues.map((q) => ({
              queueId: q.queueId,
              name: q.displayName,
              waitTimeMinutes: q.waitTimeMinutes,
              gates: q.gates.map((g) => ({
                pointId: g.pointId,
                name: g.displayName,
                recommended: g.recommended,
              })),
            })),
          };
        } catch (err) {
          throw toORPCError(err);
        }
      }),
    listGuestMessages: os
      .input(z.object({ eventId: z.string().min(1) }))
      .handler(async ({ input }): Promise<{ messages: GuestMessage[] }> => {
        try {
          const res = await guestPageClient.listGuestMessages(input);
          return {
            messages: res.messages.map((m) => ({
              messageId: m.messageId,
              body: m.body,
              sentAt: toISOString(m.sentAt),
            })),
          };
        } catch (err) {
          throw toORPCError(err);
        }
      }),
  },
  signaling: {
    // edge への接続を要求する。tolo-edge-bridge が Firestore にセッションを作成し session_id を返す。
    requestConnection: os
      .input(z.object({ edgeId: z.string().min(1) }))
      .handler(async ({ input }): Promise<{ sessionId: string }> => {
        const res = await consoleSignalingClient.requestConnection({
          edgeDeviceId: input.edgeId,
        });
        return { sessionId: res.sessionId };
      }),
    issueConsoleFirestoreToken: os.handler(() =>
      issueFirestoreToken(consoleSignalingClient),
    ),
    issueEdgeFirestoreToken: os.handler(() =>
      issueFirestoreToken(edgeSignalingClient),
    ),
  },
  observation: {
    listEdgeDevices: os.input(z.object({ eventId: z.string().min(1) })).handler(
      async ({ input }): Promise<{ devices: EdgeDevice[] }> => ({
        devices: observationMocking()
          ? sampleEdgeDevicesWire
          : await listEdgeDevices(input.eventId),
      }),
    ),
    registerEdgeDevice: os
      .input(
        z.object({
          eventId: z.string().min(1),
          name: z.string().trim().min(1),
          observationPointNames: z
            .array(z.string().trim().min(1))
            .min(1)
            .refine((names) => new Set(names).size === names.length),
        }),
      )
      .handler(async ({ input }): Promise<RegisteredEdgeDevice> => {
        if (observationMocking()) {
          return registeredEdgeDeviceWire(input);
        }
        try {
          const res = await consoleEdgeDeviceClient.registerEdgeDevice(input);
          if (!res.device) {
            throw new Error("RegisterEdgeDevice returned no device");
          }
          return {
            device: toEdgeDevice(res.device),
            observationPagePath: res.observationPagePath,
          };
        } catch (err) {
          throw toORPCError(err);
        }
      }),
    unregisterEdgeDevice: os
      .input(edgeDeviceInput)
      .handler(async ({ input }): Promise<void> => {
        if (observationMocking()) {
          return;
        }
        try {
          await consoleEdgeDeviceClient.unregisterEdgeDevice(input);
        } catch (err) {
          throw toORPCError(err);
        }
      }),
    listObservationPoints: os
      .input(edgeDeviceInput)
      .handler(
        async ({
          input,
        }): Promise<{ observationPoints: ObservationPoint[] }> => {
          const devices = observationMocking()
            ? sampleEdgeDevicesWire
            : await listEdgeDevices(input.eventId);
          const device = devices.find(
            (d) => d.edgeDeviceId === input.edgeDeviceId,
          );
          return { observationPoints: device?.observationPoints ?? [] };
        },
      ),
    heartbeat: os
      .input(
        edgeDeviceInput.extend({
          activeObservationPointIds: z.array(publicId),
        }),
      )
      .handler(async ({ input }): Promise<void> => {
        if (observationMocking()) {
          return;
        }
        await edgeEdgeDeviceClient.heartbeat(input);
      }),
    reportMeasurements: os
      .input(
        edgeDeviceInput.extend({
          measurements: z.array(
            z.object({
              observationPointId: publicId,
              windowStart: z.date(),
              windowEnd: z.date(),
              countIn: z.number().int().nonnegative(),
              countOut: z.number().int().nonnegative(),
              meanDetectedPeople: z.number().nonnegative().finite().optional(),
            }),
          ),
        }),
      )
      .handler(async ({ input }): Promise<void> => {
        if (observationMocking()) {
          return;
        }
        await edgeMeasurementIngestClient.reportMeasurements({
          eventId: input.eventId,
          edgeDeviceId: input.edgeDeviceId,
          measurements: input.measurements.map((m) => ({
            ...m,
            windowStart: timestampFromDate(m.windowStart),
            windowEnd: timestampFromDate(m.windowEnd),
            source: MeasurementSource.EDGE,
          })),
        });
      }),
  },
};
