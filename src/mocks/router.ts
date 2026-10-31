import type { CommonORPCErrorCode } from "@orpc/client";
import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import {
  type GraphViolation,
  graphDataSchema,
} from "@/features/graph/graphDataSchema";
import { PLACEHOLDER_GRAPH } from "@/features/graph/placeholderGraph";
import {
  DEFAULT_GUEST_PAGE_COMPONENTS,
  type GuestPageComponent,
} from "@/features/guest/pageComponents";
import {
  ARCHIVABLE_STATUSES,
  RESTORABLE_STATUSES,
  type TenantEvent,
} from "@/features/tenant/management/events/type";
import type { GraphData } from "@/features/tenant/management/graph/type";
import type {
  EdgeDevice,
  FirestoreToken,
  GuestCrowdSnapshot,
  GuestGuideMap,
  GuestMessage,
  GuestQueue,
  RegisteredEdgeDevice,
} from "@/server/router";
import {
  registeredEdgeDeviceWire,
  sampleEdgeDevicesWire,
} from "./fixtures/edges";
import {
  sampleGuestCrowd,
  sampleGuestMessages,
  sampleGuestQueues,
  sampleGuideMap,
} from "./fixtures/guest";

export type MockRouterOverrides = {
  /** observation.listEdgeDevices が返すエッジ端末一覧（未指定なら sampleEdgeDevicesWire） */
  devices?: EdgeDevice[];
  /** observation.listEdgeDevices を失敗させる（status: error の確認用） */
  devicesError?: boolean;
  registerEdgeDeviceError?: CommonORPCErrorCode;
  unregisterEdgeDeviceError?: CommonORPCErrorCode;
  /** graph.getGraph が返すグラフ（未指定なら PLACEHOLDER_GRAPH） */
  graph?: GraphData;
  getGraphError?: boolean;
  saveGraphError?: {
    code: CommonORPCErrorCode;
    violations?: GraphViolation[];
  };
  registerTenantError?: CommonORPCErrorCode;
  listEventsError?: boolean;
  createEventError?: CommonORPCErrorCode;
  archiveEventError?: CommonORPCErrorCode;
  restoreEventError?: CommonORPCErrorCode;
  guestComponents?: GuestPageComponent[];
  guideMap?: GuestGuideMap;
  getGuideMapError?: boolean;
};

export const MOCK_SERVER_MESSAGE = "message from the mock server";

/**
 * 本物の `@/server/router` と同じ shape のモック router。
 * server-only な `@/server/signaling`（Connect-RPC クライアント）には依存しないので、
 * ブラウザ（Storybook / next dev）でも node（Vitest）でも動く。
 * RPCHandler に載せて MSW から `/rpc` を傍受するために使う。
 */
export function createMockRouter(overrides: MockRouterOverrides = {}) {
  const {
    devices: initialDevices = sampleEdgeDevicesWire,
    devicesError = false,
    registerEdgeDeviceError,
    unregisterEdgeDeviceError,
    graph = PLACEHOLDER_GRAPH,
    getGraphError = false,
    saveGraphError,
    registerTenantError,
    listEventsError = false,
    createEventError,
    archiveEventError,
    restoreEventError,
    guestComponents = [...DEFAULT_GUEST_PAGE_COMPONENTS],
    guideMap,
    getGuideMapError = false,
  } = overrides;

  const events: TenantEvent[] = [
    { eventId: "0000000000000001", name: "Event A", status: "draft" },
    { eventId: "0000000000000002", name: "Event B", status: "open" },
    { eventId: "0000000000000003", name: "Event C", status: "locked" },
    { eventId: "0000000000000004", name: "Event D", status: "closed" },
    { eventId: "0000000000000005", name: "Event E", status: "archived" },
  ];
  let nextEventNumber = events.length + 1;
  let devices = [...initialDevices];

  return {
    graph: {
      getGraph: os
        .input(z.object({ eventId: z.string().min(1) }))
        .handler(async (): Promise<GraphData> => {
          if (getGraphError) {
            throw new ORPCError("INTERNAL_SERVER_ERROR");
          }
          return structuredClone(graph);
        }),
      saveGraph: os
        .input(z.object({ eventId: z.string().min(1), graph: graphDataSchema }))
        .handler(async (): Promise<void> => {
          if (saveGraphError !== undefined) {
            const { code, violations } = saveGraphError;
            throw new ORPCError(code, {
              message: MOCK_SERVER_MESSAGE,
              data: violations && { violations },
            });
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
      registerEdgeDevice: os
        .input(
          z.object({
            eventId: z.string().min(1),
            name: z.string().trim().min(1),
            observationPointNames: z.array(z.string().trim().min(1)).min(1),
          }),
        )
        .handler(async ({ input }): Promise<RegisteredEdgeDevice> => {
          if (registerEdgeDeviceError !== undefined) {
            throw new ORPCError(registerEdgeDeviceError, {
              message: MOCK_SERVER_MESSAGE,
            });
          }
          const registered = registeredEdgeDeviceWire(input);
          devices = [...devices, registered.device];
          return registered;
        }),
      unregisterEdgeDevice: os
        .input(
          z.object({
            eventId: z.string().min(1),
            edgeDeviceId: z.string().min(1),
          }),
        )
        .handler(async ({ input }): Promise<void> => {
          if (unregisterEdgeDeviceError !== undefined) {
            throw new ORPCError(unregisterEdgeDeviceError, {
              message: MOCK_SERVER_MESSAGE,
            });
          }
          devices = devices.filter(
            (d) => d.edgeDeviceId !== input.edgeDeviceId,
          );
        }),
    },
    tenant: {
      register: os
        .input(
          z.object({
            name: z.string().trim().min(1),
            subdomain: z.string().trim().min(1),
            ownerEmail: z.email(),
            ownerDisplayName: z.string().trim().min(1).max(64),
          }),
        )
        .handler(
          async ({
            input,
          }): Promise<{ tenantId: string; subdomain: string }> => {
            if (registerTenantError !== undefined) {
              throw new ORPCError(registerTenantError, {
                message: MOCK_SERVER_MESSAGE,
              });
            }
            return { tenantId: "00000000000000a1", subdomain: input.subdomain };
          },
        ),
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
            throw new ORPCError(createEventError, {
              message: MOCK_SERVER_MESSAGE,
            });
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
            throw new ORPCError(archiveEventError, {
              message: MOCK_SERVER_MESSAGE,
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
            throw new ORPCError(restoreEventError, {
              message: MOCK_SERVER_MESSAGE,
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
          async (): Promise<{ components: GuestPageComponent[] }> => ({
            components: guestComponents,
          }),
        ),
      getCrowd: os
        .input(z.object({ eventId: z.string().min(1), language: z.string() }))
        .handler(
          async ({ input }): Promise<GuestCrowdSnapshot> =>
            sampleGuestCrowd(input.language),
        ),
      getGuideMap: os
        .input(
          z.object({
            eventId: z.string().min(1),
            qrLocationId: z.string().optional(),
          }),
        )
        .handler(async ({ input }): Promise<GuestGuideMap> => {
          if (getGuideMapError) {
            throw new ORPCError("INTERNAL_SERVER_ERROR");
          }
          return structuredClone(
            guideMap ?? sampleGuideMap(input.qrLocationId),
          );
        }),
      getQueues: os
        .input(z.object({ eventId: z.string().min(1), language: z.string() }))
        .handler(
          async ({ input }): Promise<{ queues: GuestQueue[] }> => ({
            queues: sampleGuestQueues(input.language),
          }),
        ),
      listGuestMessages: os
        .input(z.object({ eventId: z.string().min(1) }))
        .handler(
          async (): Promise<{ messages: GuestMessage[] }> => ({
            messages: sampleGuestMessages,
          }),
        ),
    },
    signaling: {
      // WebRTC はスコープ外。呼ばれてもエラーにならないよう、ダミーの sessionId を返す。
      requestConnection: os
        .input(
          z.object({ eventId: z.string().min(1), edgeId: z.string().min(1) }),
        )
        .handler(
          async ({ input }): Promise<{ sessionId: string }> => ({
            sessionId: `mock-session_${input.edgeId}`,
          }),
        ),
      issueConsoleFirestoreToken: os
        .input(z.object({ eventId: z.string().min(1) }))
        .handler(
          async (): Promise<FirestoreToken> => ({
            customToken: "mock-console-token",
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          }),
        ),
      issueEdgeFirestoreToken: os
        .input(z.object({ eventId: z.string().min(1) }))
        .handler(
          async (): Promise<FirestoreToken> => ({
            customToken: "mock-edge-token",
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          }),
        ),
    },
  };
}
