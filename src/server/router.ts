import { timestampDate, timestampFromDate } from "@bufbuild/protobuf/wkt";
import { type Client, Code, ConnectError } from "@connectrpc/connect";
import { ORPCError, os } from "@orpc/server";
import type { SignalingService } from "@pj-hoakari/tolo-edge-bridge-client-es/tolo/edgebridge/v1/signaling_pb";
import {
  ElementKind,
  type GraphViolations,
  GraphViolationsSchema,
  ViolationKind,
} from "@pj-hoakari/tolo-graph-authoring-client-es/tolo/graph/v1/graph_pb";
import { MeasurementSource } from "@pj-hoakari/tolo-observation-client-es/tolo/observation/v1/observation_pb";
import {
  type Event,
  EventStatus as ProtoEventStatus,
} from "@pj-hoakari/tolo-tenant-management-connect-es/tolo/tenant/v1/tenant_pb";
import { z } from "zod";
import {
  type GraphViolation,
  graphDataSchema,
} from "@/features/graph/graphDataSchema";
import type {
  EventStatus,
  TenantEvent,
} from "@/features/tenant/management/events/type";
import type { GraphData } from "@/features/tenant/management/graph/type";
import { sampleEdgeDevicesWire } from "@/mocks/fixtures/edges";
import { graphAuthoringClient } from "./graphAuthoring";
import { fromGraphDocument, toGraphDocument } from "./graphDocument";
import { edgeDeviceClient, measurementIngestClient } from "./observation";
import { consoleSignalingClient, edgeSignalingClient } from "./signaling";
import { tenantManagementClient } from "./tenantManagement";

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

async function listEdgeDevices(eventId: string): Promise<EdgeDevice[]> {
  const res = await edgeDeviceClient.listEdgeDevices({ eventId });
  return res.devices.map((d) => ({
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
  }));
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
};

function toORPCError(err: unknown): unknown {
  if (!(err instanceof ConnectError)) return err;
  const code = ORPC_ERROR_CODES[err.code];
  return code ? new ORPCError(code, { message: err.rawMessage }) : err;
}

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
              message: err.rawMessage,
              data: {
                violations: err
                  .findDetails(GraphViolationsSchema)
                  .flatMap(toGraphViolations),
              },
            });
          }
          throw err;
        }
      }),
  },
  tenant: {
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
        await edgeDeviceClient.heartbeat(input);
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
        await measurementIngestClient.reportMeasurements({
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
