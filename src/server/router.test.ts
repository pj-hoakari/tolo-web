import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError } from "@connectrpc/connect";
import { call, ORPCError } from "@orpc/server";
import {
  ElementKind,
  GraphViolationsSchema,
  ViolationKind,
} from "@pj-hoakari/tolo-graph-authoring-client-es/tolo/graph/v1/graph_pb";
import {
  CrowdLevel,
  GetCrowdResponseSchema,
  GetQueuesResponseSchema,
  GuestComponent,
  ListGuestMessagesResponseSchema,
  OpenGuestPageResponseSchema,
} from "@pj-hoakari/tolo-guest-client-es/tolo/guest/v1/guest_pb";
import {
  EdgeDeviceSchema,
  HeartbeatResponseSchema,
  ListEdgeDevicesResponseSchema,
  RegisterEdgeDeviceResponseSchema,
  ReportMeasurementsResponseSchema,
  UnregisterEdgeDeviceResponseSchema,
} from "@pj-hoakari/tolo-observation-client-es/tolo/observation/v1/observation_pb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PLACEHOLDER_GRAPH } from "@/features/graph/placeholderGraph";
import { sampleEdgeDevicesWire } from "@/mocks/fixtures/edges";
import { sampleGuideMap } from "@/mocks/fixtures/guest";
import { graphAuthoringClient } from "./graphAuthoring";
import { guestPageClient } from "./guest";
import { issueRegistrationToken } from "./idp";
import {
  consoleEdgeDeviceClient,
  edgeEdgeDeviceClient,
  edgeMeasurementIngestClient,
} from "./observation";
import { router } from "./router";
import { tenantRegistrationClient } from "./tenantManagement";

vi.hoisted(() => {
  process.env.GATEWAY_URL = "http://127.0.0.1:9";
});
vi.mock("server-only", () => ({}));
vi.mock(
  "@pj-hoakari/tolo-tenant-management-connect-es/tolo/tenant/v1/tenant_pb",
  () => ({ EventStatus: {}, TenantService: { methods: [] } }),
);

vi.mock("./tenantManagement", () => ({
  tenantRegistrationClient: {
    startTenantRegistration: vi.fn(),
    claimTenantOwnership: vi.fn(),
  },
}));
vi.mock("./idp", () => ({ issueRegistrationToken: vi.fn() }));

const eventId = "fedcba9876543210";
const [device] = sampleEdgeDevicesWire;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("graph.saveGraph", () => {
  const save = () =>
    call(router.graph.saveGraph, { eventId, graph: PLACEHOLDER_GRAPH });

  it("passes the violations in the error details to the browser as plain values without the server message", async () => {
    vi.spyOn(graphAuthoringClient, "saveGraph").mockRejectedValue(
      new ConnectError("invalid graph document", Code.InvalidArgument, {}, [
        {
          desc: GraphViolationsSchema,
          value: {
            violations: [
              {
                kind: ViolationKind.NODE_WITHOUT_ROUTE,
                elementKind: ElementKind.NODE,
                elementId: "p1",
              },
              {
                kind: ViolationKind.MISSING_PARENT_GROUP,
                elementKind: ElementKind.GROUP,
                elementId: "g1",
                relatedIds: ["g0"],
              },
              {
                kind: ViolationKind.MISSING_NODE,
                elementKind: ElementKind.EDGE,
                elementId: "e1",
                relatedIds: ["a", "b"],
              },
              {
                kind: 99 as ViolationKind,
                elementKind: 99 as ElementKind,
                elementId: "",
              },
            ],
          },
        },
      ]),
    );

    const error = await save().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ORPCError);
    expect((error as ORPCError<string, unknown>).message).not.toContain(
      "invalid graph document",
    );
    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      data: {
        violations: [
          {
            kind: "NODE_WITHOUT_ROUTE",
            elementKind: "node",
            elementId: "p1",
            relatedIds: [],
          },
          {
            kind: "MISSING_PARENT_GROUP",
            elementKind: "group",
            elementId: "g1",
            relatedIds: ["g0"],
          },
          {
            kind: "MISSING_NODE",
            elementKind: "edge",
            elementId: "e1",
            relatedIds: ["a", "b"],
          },
          {
            kind: "UNSPECIFIED",
            elementKind: null,
            elementId: "",
            relatedIds: [],
          },
        ],
      },
    });
  });

  it("passes no violations when the error has no details", async () => {
    vi.spyOn(graphAuthoringClient, "saveGraph").mockRejectedValue(
      new ConnectError("invalid graph document", Code.InvalidArgument),
    );

    await expect(save()).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { violations: [] },
    });
  });

  it("passes a rejected precondition to the browser as its code without the server message", async () => {
    vi.spyOn(graphAuthoringClient, "saveGraph").mockRejectedValue(
      new ConnectError("event is archived", Code.FailedPrecondition),
    );

    const error = await save().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ORPCError);
    expect(error).toMatchObject({ code: "PRECONDITION_FAILED" });
    expect((error as ORPCError<string, unknown>).message).not.toContain(
      "event is archived",
    );
  });
});

describe("tenant.register", () => {
  const tenantId = "0123456789abcdef";
  const register = () =>
    call(router.tenant.register, {
      name: "Acme",
      subdomain: "acme",
      ownerEmail: "owner@example.com",
    });

  it("starts a registration with the standard plan, then claims it with a registration token issued to the owner", async () => {
    const start = vi
      .mocked(tenantRegistrationClient.startTenantRegistration)
      .mockResolvedValue({
        tenant: { tenantId },
        ownershipClaimToken: "claim-token",
      } as never);
    const issue = vi
      .mocked(issueRegistrationToken)
      .mockResolvedValue("registration-token");
    const claim = vi
      .mocked(tenantRegistrationClient.claimTenantOwnership)
      .mockResolvedValue({ tenant: { tenantId, subdomain: "acme" } } as never);

    await expect(register()).resolves.toEqual({ tenantId, subdomain: "acme" });

    expect(start).toHaveBeenCalledWith({
      name: "Acme",
      contractPlan: "standard",
    });
    expect(issue).toHaveBeenCalledWith("owner@example.com");
    expect(claim).toHaveBeenCalledWith(
      { tenantId, ownershipClaimToken: "claim-token", subdomain: "acme" },
      { headers: { Authorization: "Bearer registration-token" } },
    );
    expect(start.mock.invocationCallOrder[0]).toBeLessThan(
      issue.mock.invocationCallOrder[0],
    );
    expect(issue.mock.invocationCallOrder[0]).toBeLessThan(
      claim.mock.invocationCallOrder[0],
    );
  });

  it("passes a taken subdomain to the browser as a conflict without the server message", async () => {
    vi.mocked(
      tenantRegistrationClient.startTenantRegistration,
    ).mockResolvedValue({
      tenant: { tenantId },
      ownershipClaimToken: "claim-token",
    } as never);
    vi.mocked(issueRegistrationToken).mockResolvedValue("registration-token");
    vi.mocked(tenantRegistrationClient.claimTenantOwnership).mockRejectedValue(
      new ConnectError("subdomain is taken", Code.AlreadyExists),
    );

    const error = await register().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ORPCError);
    expect(error).toMatchObject({ code: "CONFLICT" });
    expect((error as ORPCError<string, unknown>).message).not.toContain(
      "subdomain is taken",
    );
  });
});

const protoDevice = create(EdgeDeviceSchema, {
  edgeDeviceId: "0123456789abcdef",
  name: "受付カメラ",
  online: false,
  lastHeartbeatAt: timestampFromDate(new Date("2026-06-14T10:00:00.000Z")),
  observationPoints: [{ observationPointId: "1111111111111111", name: "受付" }],
});
const wireDevice = {
  edgeDeviceId: "0123456789abcdef",
  name: "受付カメラ",
  online: false,
  lastHeartbeatAt: "2026-06-14T10:00:00.000Z",
  observationPoints: [{ observationPointId: "1111111111111111", name: "受付" }],
};

describe("guest", () => {
  it("opens the guest page with the QR location and session and returns the known components in order", async () => {
    const open = vi.spyOn(guestPageClient, "openGuestPage").mockResolvedValue(
      create(OpenGuestPageResponseSchema, {
        components: [
          GuestComponent.STAFF_MESSAGES,
          GuestComponent.UNSPECIFIED,
          GuestComponent.CROWD,
        ],
      }),
    );

    await expect(
      call(router.guest.openGuestPage, {
        eventId,
        qrLocationId: "gate east",
        sessionId: "session-1",
      }),
    ).resolves.toEqual({ components: ["staffMessages", "crowd"] });
    expect(open).toHaveBeenCalledWith({
      eventId,
      qrLocationId: "gate east",
      sessionId: "session-1",
    });
  });

  it("returns the crowd with its time as plain values and drops entries without a level or target", async () => {
    const getCrowd = vi.spyOn(guestPageClient, "getCrowd").mockResolvedValue(
      create(GetCrowdResponseSchema, {
        takenAt: timestampFromDate(new Date("2026-06-15T05:28:00Z")),
        crowd: [
          {
            target: { case: "pointId", value: "p1" },
            displayName: "Entrance gate",
            level: CrowdLevel.HIGH,
            danger: true,
          },
          {
            target: { case: "routeId", value: "r1" },
            displayName: "Corridor",
            level: CrowdLevel.LOW,
          },
          {
            target: { case: "pointId", value: "p2" },
            displayName: "Unknown",
            level: CrowdLevel.UNSPECIFIED,
          },
          { displayName: "No target", level: CrowdLevel.MID },
        ],
      }),
    );

    await expect(
      call(router.guest.getCrowd, { eventId, language: "en" }),
    ).resolves.toEqual({
      takenAt: "2026-06-15T05:28:00.000Z",
      crowd: [
        {
          id: "pointId:p1",
          name: "Entrance gate",
          level: "high",
          danger: true,
        },
        { id: "routeId:r1", name: "Corridor", level: "low", danger: false },
      ],
    });
    expect(getCrowd).toHaveBeenCalledWith({ eventId, language: "en" });
  });

  it("returns the sample guide map as a guest graph and a layout without reaching the guest service", async () => {
    const guestCalls = (
      Object.keys(guestPageClient) as (keyof typeof guestPageClient)[]
    ).map((method) => vi.spyOn(guestPageClient, method));

    const guideMap = await call(router.guest.getGuideMap, { eventId });

    expect(guideMap).toEqual(sampleGuideMap());
    expect(guideMap.graph.points).toContainEqual({
      pointId: "n_fc14f2f4",
      labels: { ja: "エレベーター", en: "Elevator" },
    });
    expect(
      guideMap.layout.groups.map(
        ({ groupId }) =>
          guideMap.graph.groups.find((g) => g.groupId === groupId)?.labels.ja,
      ),
    ).toEqual(["1F", "2F", "3F", "4F", "5F", "6Fホール"]);
    for (const spy of guestCalls) expect(spy).not.toHaveBeenCalled();
  });

  it("returns the queues with their gates and without the turnaround count", async () => {
    vi.spyOn(guestPageClient, "getQueues").mockResolvedValue(
      create(GetQueuesResponseSchema, {
        queues: [
          {
            queueId: "q1",
            displayName: "Merch",
            waitTimeMinutes: 12.2,
            turnaroundCount: 3,
            gates: [
              { pointId: "g1", displayName: "West gate", recommended: true },
            ],
          },
        ],
      }),
    );

    await expect(
      call(router.guest.getQueues, { eventId, language: "ja" }),
    ).resolves.toEqual({
      queues: [
        {
          queueId: "q1",
          name: "Merch",
          waitTimeMinutes: 12.2,
          gates: [{ pointId: "g1", name: "West gate", recommended: true }],
        },
      ],
    });
  });

  it("returns the guest messages with their sent time as plain values", async () => {
    vi.spyOn(guestPageClient, "listGuestMessages").mockResolvedValue(
      create(ListGuestMessagesResponseSchema, {
        messages: [
          {
            messageId: "m1",
            body: "Hello",
            sentAt: timestampFromDate(new Date("2026-06-15T04:05:00Z")),
          },
          { messageId: "m2", body: "No time" },
        ],
      }),
    );

    await expect(
      call(router.guest.listGuestMessages, { eventId }),
    ).resolves.toEqual({
      messages: [
        { messageId: "m1", body: "Hello", sentAt: "2026-06-15T04:05:00.000Z" },
        { messageId: "m2", body: "No time", sentAt: null },
      ],
    });
  });

  it("passes an argument rejected by the guest service to the browser as its code", async () => {
    vi.spyOn(guestPageClient, "getQueues").mockRejectedValue(
      new ConnectError("event_id is required", Code.InvalidArgument),
    );

    await expect(
      call(router.guest.getQueues, { eventId, language: "ja" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("observation.registerEdgeDevice", () => {
  const register = (input: { name: string; observationPointNames: string[] }) =>
    call(router.observation.registerEdgeDevice, { eventId, ...input });

  it("registers the trimmed names with the console credentials and returns the device and its observation page path", async () => {
    const consoleRegister = vi
      .spyOn(consoleEdgeDeviceClient, "registerEdgeDevice")
      .mockResolvedValue(
        create(RegisterEdgeDeviceResponseSchema, {
          device: protoDevice,
          observationPagePath: `/event/${eventId}/observation/0123456789abcdef`,
        }),
      );
    const edgeRegister = vi.spyOn(edgeEdgeDeviceClient, "registerEdgeDevice");

    await expect(
      register({ name: " 受付カメラ ", observationPointNames: [" 受付 "] }),
    ).resolves.toEqual({
      device: wireDevice,
      observationPagePath: `/event/${eventId}/observation/0123456789abcdef`,
    });
    expect(consoleRegister).toHaveBeenCalledWith({
      eventId,
      name: "受付カメラ",
      observationPointNames: ["受付"],
    });
    expect(edgeRegister).not.toHaveBeenCalled();
  });

  it.each([
    { name: " ", observationPointNames: ["受付"] },
    { name: "受付カメラ", observationPointNames: [] },
    { name: "受付カメラ", observationPointNames: [" "] },
    { name: "受付カメラ", observationPointNames: ["受付", " 受付"] },
  ])(
    "rejects %j as a bad request without reaching the gateway",
    async (input) => {
      const consoleRegister = vi.spyOn(
        consoleEdgeDeviceClient,
        "registerEdgeDevice",
      );

      await expect(register(input)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(consoleRegister).not.toHaveBeenCalled();
    },
  );

  it("passes an argument rejected by the gateway to the browser as its code without the server message", async () => {
    vi.spyOn(consoleEdgeDeviceClient, "registerEdgeDevice").mockRejectedValue(
      new ConnectError("edge device name is required", Code.InvalidArgument),
    );

    const error = await register({
      name: "受付カメラ",
      observationPointNames: ["受付"],
    }).catch((e: unknown) => e);

    expect(error).toMatchObject({ code: "BAD_REQUEST" });
    expect((error as ORPCError<string, unknown>).message).not.toContain(
      "edge device name is required",
    );
  });
});

describe("observation.unregisterEdgeDevice", () => {
  const unregister = () =>
    call(router.observation.unregisterEdgeDevice, {
      eventId,
      edgeDeviceId: "0123456789abcdef",
    });

  it("unregisters with the console credentials", async () => {
    const consoleUnregister = vi
      .spyOn(consoleEdgeDeviceClient, "unregisterEdgeDevice")
      .mockResolvedValue(
        create(UnregisterEdgeDeviceResponseSchema, { device: protoDevice }),
      );
    const edgeUnregister = vi.spyOn(
      edgeEdgeDeviceClient,
      "unregisterEdgeDevice",
    );

    await expect(unregister()).resolves.toBeUndefined();
    expect(consoleUnregister).toHaveBeenCalledWith({
      eventId,
      edgeDeviceId: "0123456789abcdef",
    });
    expect(edgeUnregister).not.toHaveBeenCalled();
  });

  it("passes an already unregistered device to the browser as a rejected precondition", async () => {
    vi.spyOn(consoleEdgeDeviceClient, "unregisterEdgeDevice").mockRejectedValue(
      new ConnectError("edge device is unregistered", Code.FailedPrecondition),
    );

    await expect(unregister()).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });
});

describe("observation credentials by caller", () => {
  it("lists edge devices and their observation points with the console credentials", async () => {
    const consoleList = vi
      .spyOn(consoleEdgeDeviceClient, "listEdgeDevices")
      .mockResolvedValue(
        create(ListEdgeDevicesResponseSchema, { devices: [protoDevice] }),
      );
    const edgeList = vi.spyOn(edgeEdgeDeviceClient, "listEdgeDevices");

    await expect(
      call(router.observation.listEdgeDevices, { eventId }),
    ).resolves.toEqual({ devices: [wireDevice] });
    await expect(
      call(router.observation.listObservationPoints, {
        eventId,
        edgeDeviceId: "0123456789abcdef",
      }),
    ).resolves.toEqual({ observationPoints: wireDevice.observationPoints });
    expect(consoleList).toHaveBeenCalledTimes(2);
    expect(edgeList).not.toHaveBeenCalled();
  });

  it("sends heartbeats and measurements with the edge credentials", async () => {
    const edgeHeartbeat = vi
      .spyOn(edgeEdgeDeviceClient, "heartbeat")
      .mockResolvedValue(create(HeartbeatResponseSchema));
    const consoleHeartbeat = vi.spyOn(consoleEdgeDeviceClient, "heartbeat");
    const report = vi
      .spyOn(edgeMeasurementIngestClient, "reportMeasurements")
      .mockResolvedValue(create(ReportMeasurementsResponseSchema));

    await call(router.observation.heartbeat, {
      eventId,
      edgeDeviceId: "0123456789abcdef",
      activeObservationPointIds: [],
    });
    await call(router.observation.reportMeasurements, {
      eventId,
      edgeDeviceId: "0123456789abcdef",
      measurements: [],
    });

    expect(edgeHeartbeat).toHaveBeenCalledOnce();
    expect(consoleHeartbeat).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledOnce();
  });
});

describe("observation procedures with OBSERVATION_API_MOCKING", () => {
  it("answer with the sample edge devices without reaching the gateway in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OBSERVATION_API_MOCKING", "enabled");

    await expect(
      call(router.observation.listEdgeDevices, { eventId }),
    ).resolves.toEqual({ devices: sampleEdgeDevicesWire });
    await expect(
      call(router.observation.listObservationPoints, {
        eventId,
        edgeDeviceId: device.edgeDeviceId,
      }),
    ).resolves.toEqual({ observationPoints: device.observationPoints });
    await expect(
      call(router.observation.heartbeat, {
        eventId,
        edgeDeviceId: device.edgeDeviceId,
        activeObservationPointIds: [],
      }),
    ).resolves.toBeUndefined();
    await expect(
      call(router.observation.reportMeasurements, {
        eventId,
        edgeDeviceId: device.edgeDeviceId,
        measurements: [],
      }),
    ).resolves.toBeUndefined();
    const { device: registered, observationPagePath } = await call(
      router.observation.registerEdgeDevice,
      { eventId, name: "受付カメラ", observationPointNames: ["受付"] },
    );
    expect(registered).toMatchObject({
      name: "受付カメラ",
      online: false,
      observationPoints: [{ name: "受付" }],
    });
    expect(observationPagePath).toBe(
      `/event/${eventId}/observation/${registered.edgeDeviceId}`,
    );
    await expect(
      call(router.observation.unregisterEdgeDevice, {
        eventId,
        edgeDeviceId: registered.edgeDeviceId,
      }),
    ).resolves.toBeUndefined();
  });

  it("reach the gateway in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OBSERVATION_API_MOCKING", "enabled");

    await expect(
      call(router.observation.listEdgeDevices, { eventId }),
    ).rejects.toThrow();
  });

  it("reach the gateway when not enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OBSERVATION_API_MOCKING", undefined);

    await expect(
      call(router.observation.listEdgeDevices, { eventId }),
    ).rejects.toThrow();
  });
});
