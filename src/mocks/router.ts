import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import { graphDataSchema } from "@/features/graph/graphDataSchema";
import { PLACEHOLDER_GRAPH } from "@/features/graph/placeholderGraph";
import {
  ARCHIVABLE_STATUSES,
  RESTORABLE_STATUSES,
  type TenantEvent,
} from "@/features/tenant/management/events/type";
import type { GraphData } from "@/features/tenant/management/graph/type";
import type { EdgeDevice, FirestoreToken } from "@/server/router";
import { sampleEdgeDevicesWire } from "./fixtures/edges";

export type MockRouterOverrides = {
  /** observation.listEdgeDevices が返すエッジ端末一覧（未指定なら sampleEdgeDevicesWire） */
  devices?: EdgeDevice[];
  /** observation.listEdgeDevices を失敗させる（status: error の確認用） */
  devicesError?: boolean;
  getGraphError?: boolean;
  saveGraphError?: string;
  listEventsError?: boolean;
  createEventError?: string;
  archiveEventError?: string;
  restoreEventError?: string;
};

/**
 * 本物の `@/server/router` と同じ shape のモック router。
 * server-only な `@/server/signaling`（Connect-RPC クライアント）には依存しないので、
 * ブラウザ（Storybook / next dev）でも node（Vitest）でも動く。
 * RPCHandler に載せて MSW から `/rpc` を傍受するために使う。
 */
export function createMockRouter(overrides: MockRouterOverrides = {}) {
  const {
    devices = sampleEdgeDevicesWire,
    devicesError = false,
    getGraphError = false,
    saveGraphError,
    listEventsError = false,
    createEventError,
    archiveEventError,
    restoreEventError,
  } = overrides;

  const events: TenantEvent[] = [
    { eventId: "0000000000000001", name: "Event A", status: "draft" },
    { eventId: "0000000000000002", name: "Event B", status: "open" },
    { eventId: "0000000000000003", name: "Event C", status: "locked" },
    { eventId: "0000000000000004", name: "Event D", status: "closed" },
    { eventId: "0000000000000005", name: "Event E", status: "archived" },
  ];
  let nextEventNumber = events.length + 1;

  return {
    graph: {
      getGraph: os
        .input(z.object({ eventId: z.string().min(1) }))
        .handler(async (): Promise<GraphData> => {
          if (getGraphError) {
            throw new ORPCError("INTERNAL_SERVER_ERROR");
          }
          return structuredClone(PLACEHOLDER_GRAPH);
        }),
      saveGraph: os
        .input(z.object({ eventId: z.string().min(1), graph: graphDataSchema }))
        .handler(async (): Promise<void> => {
          if (saveGraphError !== undefined) {
            throw new ORPCError("BAD_REQUEST", { message: saveGraphError });
          }
        }),
    },
    observation: {
      listEdgeDevices: os
        .input(z.object({ eventId: z.string().min(1) }))
        .handler(async (): Promise<{ devices: EdgeDevice[] }> => {
          if (devicesError) {
            throw new ORPCError("INTERNAL_SERVER_ERROR", {
              message: "エッジ一覧の取得に失敗しました（モック）",
            });
          }
          return { devices };
        }),
    },
    tenant: {
      listEvents: os
        .input(
          z.object({
            tenantId: z.string().min(1),
            includeArchived: z.boolean().default(false),
          }),
        )
        .handler(async ({ input }): Promise<{ events: TenantEvent[] }> => {
          if (listEventsError) {
            throw new ORPCError("INTERNAL_SERVER_ERROR");
          }
          return {
            events: input.includeArchived
              ? [...events]
              : events.filter((e) => e.status !== "archived"),
          };
        }),
      createEvent: os
        .input(
          z.object({
            tenantId: z.string().min(1),
            name: z.string().trim().min(1),
          }),
        )
        .handler(async ({ input }): Promise<TenantEvent> => {
          if (createEventError !== undefined) {
            throw new ORPCError("BAD_REQUEST", { message: createEventError });
          }
          const event: TenantEvent = {
            eventId: (nextEventNumber++).toString(16).padStart(16, "0"),
            name: input.name,
            status: "draft",
          };
          events.push(event);
          return event;
        }),
      archiveEvent: os
        .input(z.object({ eventId: z.string().min(1) }))
        .handler(async ({ input }): Promise<TenantEvent> => {
          if (archiveEventError !== undefined) {
            throw new ORPCError("PRECONDITION_FAILED", {
              message: archiveEventError,
            });
          }
          const event = events.find((e) => e.eventId === input.eventId);
          if (!event) {
            throw new ORPCError("NOT_FOUND");
          }
          if (!ARCHIVABLE_STATUSES.has(event.status)) {
            throw new ORPCError("PRECONDITION_FAILED", {
              message: `event status ${event.status} cannot transition to archived`,
            });
          }
          event.status = "archived";
          return event;
        }),
      restoreEvent: os
        .input(z.object({ eventId: z.string().min(1) }))
        .handler(async ({ input }): Promise<TenantEvent> => {
          if (restoreEventError !== undefined) {
            throw new ORPCError("PRECONDITION_FAILED", {
              message: restoreEventError,
            });
          }
          const event = events.find((e) => e.eventId === input.eventId);
          if (!event) {
            throw new ORPCError("NOT_FOUND");
          }
          if (!RESTORABLE_STATUSES.has(event.status)) {
            throw new ORPCError("PRECONDITION_FAILED", {
              message: `event status ${event.status} cannot transition to closed`,
            });
          }
          event.status = "closed";
          return event;
        }),
    },
    signaling: {
      // WebRTC はスコープ外。呼ばれてもエラーにならないよう、ダミーの sessionId を返す。
      requestConnection: os
        .input(z.object({ edgeId: z.string().min(1) }))
        .handler(
          async ({ input }): Promise<{ sessionId: string }> => ({
            sessionId: `mock-session_${input.edgeId}`,
          }),
        ),
      issueConsoleFirestoreToken: os.handler(
        async (): Promise<FirestoreToken> => ({
          customToken: "mock-console-token",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        }),
      ),
      issueEdgeFirestoreToken: os.handler(
        async (): Promise<FirestoreToken> => ({
          customToken: "mock-edge-token",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        }),
      ),
    },
  };
}
