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
  GetGuideMapResponseSchema,
  GetQueuesResponseSchema,
  GuestComponent,
  ListGuestMessagesResponseSchema,
  OpenGuestPageResponseSchema,
} from "@pj-hoakari/tolo-guest-client-es/tolo/guest/v1/guest_pb";
import {
  EdgeDeviceSchema,
  EventType,
  GetObservationSettingsResponseSchema,
  HeartbeatResponseSchema,
  ListEdgeDeviceObservationPointsResponseSchema,
  ListEdgeDevicesResponseSchema,
  RegisterEdgeDeviceResponseSchema,
  ReportMeasurementsResponseSchema,
  UnregisterEdgeDeviceResponseSchema,
  UpdateObservationSettingsResponseSchema,
} from "@pj-hoakari/tolo-observation-client-es/tolo/observation/v1/observation_pb";
import { Role } from "@pj-hoakari/tolo-tenant-management-connect-es/tolo/relation/v1/relation_pb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PLACEHOLDER_GRAPH } from "@/features/graph/placeholderGraph";
import { sampleEdgeDevicesWire } from "@/mocks/fixtures/edges";
import { afterJoinPath, getRegistrationToken, requestTenantId } from "./auth";
import { forgetInvitation, pendingInvitationToken } from "./auth/invitation";
import { graphAuthoringClient } from "./graphAuthoring";
import { guestPageClient } from "./guest";
import { issueRegistrationToken } from "./idp";
import {
  consoleEdgeDeviceClient,
  consoleObservationSettingsClient,
  edgeEdgeDeviceClient,
  edgeMeasurementIngestClient,
} from "./observation";
import { router } from "./router";
import {
  relationAdminClient,
  relationRegistrationClient,
  tenantRegistrationClient,
} from "./tenantManagement";

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
  relationAdminClient: {
    listMemberships: vi.fn(),
    changeTenantRole: vi.fn(),
    revokeRole: vi.fn(),
    grantEventRole: vi.fn(),
    listTenantInvitations: vi.fn(),
    createTenantInvitation: vi.fn(),
    revokeTenantInvitation: vi.fn(),
  },
  relationRegistrationClient: { acceptTenantInvitation: vi.fn() },
}));
vi.mock("./auth", () => ({
  afterJoinPath: vi.fn(),
  getRegistrationToken: vi.fn(),
  requestTenantId: vi.fn(),
}));
vi.mock("./auth/invitation", () => ({
  forgetInvitation: vi.fn(),
  pendingInvitationToken: vi.fn(),
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
      ownerDisplayName: " Owner ",
    });

  it("starts a registration with the standard plan, then claims it with a registration token issued to the owner and the owner's trimmed display name", async () => {
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
      {
        tenantId,
        ownershipClaimToken: "claim-token",
        subdomain: "acme",
        displayName: "Owner",
      },
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

describe("tenant members and invitations", () => {
  const tenantId = "0123456789abcdef";
  const owner = {
    userId: "user-owner",
    tenantId,
    tenantRole: Role.OWNER,
    displayName: "山田",
    joinedAt: timestampFromDate(new Date("2026-10-01T00:00:00.000Z")),
    eventRoles: [{ eventId: "0000000000000001", role: Role.OWNER }],
  };

  it("lists the tenant's members with their display name, role, the time they joined, and their event roles", async () => {
    const list = vi
      .mocked(relationAdminClient.listMemberships)
      .mockResolvedValue({
        memberships: [
          owner,
          {
            ...owner,
            userId: "user-staff",
            tenantRole: Role.STAFF,
            displayName: "佐藤",
            joinedAt: undefined,
            eventRoles: [],
          },
        ],
      } as never);

    await expect(
      call(router.tenant.listMembers, { tenantId }),
    ).resolves.toEqual({
      members: [
        {
          userId: "user-owner",
          displayName: "山田",
          role: "owner",
          joinedAt: "2026-10-01T00:00:00.000Z",
          eventRoles: [{ eventId: "0000000000000001", role: "owner" }],
        },
        {
          userId: "user-staff",
          displayName: "佐藤",
          role: "staff",
          joinedAt: null,
          eventRoles: [],
        },
      ],
    });
    expect(list).toHaveBeenCalledWith({
      filter: { case: "tenantId", value: tenantId },
    });
  });

  it("creates every invitation with the staff role and the trimmed display name, and returns the token once", async () => {
    const create = vi
      .mocked(relationAdminClient.createTenantInvitation)
      .mockResolvedValue({
        invitation: {
          invitationId: "inv-1",
          tenantId,
          tenantRole: Role.STAFF,
          displayName: "鈴木",
          expiresAt: timestampFromDate(new Date("2026-11-07T00:00:00.000Z")),
        },
        invitationToken: "invitation-token",
      } as never);

    await expect(
      call(router.tenant.createInvitation, {
        tenantId,
        displayName: " 鈴木 ",
      }),
    ).resolves.toEqual({
      invitation: {
        invitationId: "inv-1",
        displayName: "鈴木",
        expiresAt: "2026-11-07T00:00:00.000Z",
      },
      invitationToken: "invitation-token",
    });
    expect(create).toHaveBeenCalledWith({
      tenantId,
      tenantRole: Role.STAFF,
      displayName: "鈴木",
    });
  });

  it("refuses a display name longer than 64 characters before calling the gateway", async () => {
    const error = await call(router.tenant.createInvitation, {
      tenantId,
      displayName: "a".repeat(65),
    }).catch((e: unknown) => e);

    expect(error).toMatchObject({ code: "BAD_REQUEST" });
    expect(relationAdminClient.createTenantInvitation).not.toHaveBeenCalled();
  });

  it("changes a member's tenant role", async () => {
    const change = vi
      .mocked(relationAdminClient.changeTenantRole)
      .mockResolvedValue({
        membership: { ...owner, userId: "user-staff" },
      } as never);

    await expect(
      call(router.tenant.changeMemberRole, {
        tenantId,
        userId: "user-staff",
        role: "owner",
      }),
    ).resolves.toMatchObject({ userId: "user-staff", role: "owner" });
    expect(change).toHaveBeenCalledWith({
      tenantId,
      userId: "user-staff",
      tenantRole: Role.OWNER,
    });
  });

  it("removes a member by revoking the tenant membership", async () => {
    const revoke = vi
      .mocked(relationAdminClient.revokeRole)
      .mockResolvedValue({} as never);

    await call(router.tenant.removeMember, { tenantId, userId: "user-staff" });

    expect(revoke).toHaveBeenCalledWith({
      userId: "user-staff",
      scope: { case: "tenantId", value: tenantId },
    });
  });

  it.each([
    [
      "demoting",
      () =>
        call(router.tenant.changeMemberRole, {
          tenantId,
          userId: "user-owner",
          role: "staff",
        }),
    ],
    [
      "removing",
      () =>
        call(router.tenant.removeMember, { tenantId, userId: "user-owner" }),
    ],
  ])(
    "passes the refusal of %s the last owner to the browser as a rejected precondition without the server message",
    async (_, run) => {
      const refusal = new ConnectError(
        "the tenant must keep at least one owner",
        Code.FailedPrecondition,
      );
      vi.mocked(relationAdminClient.changeTenantRole).mockRejectedValue(
        refusal,
      );
      vi.mocked(relationAdminClient.revokeRole).mockRejectedValue(refusal);

      const error = await run().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ORPCError);
      expect(error).toMatchObject({ code: "PRECONDITION_FAILED" });
      expect((error as ORPCError<string, unknown>).message).not.toContain(
        "owner",
      );
    },
  );

  it("grants an event role to a member and returns the member with it", async () => {
    const grant = vi
      .mocked(relationAdminClient.grantEventRole)
      .mockResolvedValue({
        membership: {
          ...owner,
          userId: "user-staff",
          tenantRole: Role.STAFF,
          eventRoles: [{ eventId: "0000000000000002", role: Role.STAFF }],
        },
      } as never);

    await expect(
      call(router.tenant.grantEventRole, {
        eventId: "0000000000000002",
        userId: "user-staff",
        role: "staff",
      }),
    ).resolves.toMatchObject({
      userId: "user-staff",
      eventRoles: [{ eventId: "0000000000000002", role: "staff" }],
    });
    expect(grant).toHaveBeenCalledWith({
      eventId: "0000000000000002",
      userId: "user-staff",
      role: Role.STAFF,
    });
  });

  it("revokes only the event role, leaving the tenant membership", async () => {
    const revoke = vi
      .mocked(relationAdminClient.revokeRole)
      .mockResolvedValue({} as never);

    await call(router.tenant.revokeEventRole, {
      eventId: "0000000000000002",
      userId: "user-staff",
    });

    expect(revoke).toHaveBeenCalledWith({
      userId: "user-staff",
      scope: { case: "eventId", value: "0000000000000002" },
    });
  });

  it("lists the unused invitations without their tokens and revokes one by its ID", async () => {
    vi.mocked(relationAdminClient.listTenantInvitations).mockResolvedValue({
      invitations: [
        {
          invitationId: "inv-1",
          tenantId,
          tenantRole: Role.STAFF,
          displayName: "鈴木",
          expiresAt: undefined,
        },
      ],
    } as never);
    const revoke = vi
      .mocked(relationAdminClient.revokeTenantInvitation)
      .mockResolvedValue({} as never);

    await expect(
      call(router.tenant.listInvitations, { tenantId }),
    ).resolves.toEqual({
      invitations: [
        { invitationId: "inv-1", displayName: "鈴木", expiresAt: null },
      ],
    });
    await call(router.tenant.revokeInvitation, {
      tenantId,
      invitationId: "inv-1",
    });
    expect(revoke).toHaveBeenCalledWith({ tenantId, invitationId: "inv-1" });
  });
});

describe("tenant.acceptInvitation", () => {
  const accept = () => call(router.tenant.acceptInvitation, undefined);
  const pending = () => {
    vi.mocked(pendingInvitationToken).mockResolvedValue("invitation-token");
    vi.mocked(requestTenantId).mockResolvedValue("0123456789abcdef");
    vi.mocked(getRegistrationToken).mockResolvedValue("registration-token");
    vi.mocked(afterJoinPath).mockReturnValue("/management");
  };

  it("accepts the kept invitation for the tenant of the host with a registration token, forgets it, and returns where to go next", async () => {
    pending();
    const acceptTenantInvitation = vi
      .mocked(relationRegistrationClient.acceptTenantInvitation)
      .mockResolvedValue({} as never);

    await expect(accept()).resolves.toEqual({ next: "/management" });
    expect(acceptTenantInvitation).toHaveBeenCalledWith(
      { tenantId: "0123456789abcdef", invitationToken: "invitation-token" },
      { headers: { Authorization: "Bearer registration-token" } },
    );
    expect(forgetInvitation).toHaveBeenCalled();
  });

  it.each<[string, string | undefined, string | undefined]>([
    ["no invitation is kept", undefined, "0123456789abcdef"],
    ["the host is not a tenant", "invitation-token", undefined],
  ])(
    "answers not found without calling the gateway when %s",
    async (_, token, tenantId) => {
      vi.mocked(pendingInvitationToken).mockResolvedValue(token);
      vi.mocked(requestTenantId).mockResolvedValue(tenantId);

      await expect(accept()).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(getRegistrationToken).not.toHaveBeenCalled();
      expect(
        relationRegistrationClient.acceptTenantInvitation,
      ).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["an unusable invitation", Code.Unauthenticated, "UNAUTHORIZED"],
    ["an existing membership", Code.FailedPrecondition, "PRECONDITION_FAILED"],
  ])(
    "passes the refusal of %s to the browser by its code without the server message and keeps the invitation",
    async (_, code, expected) => {
      pending();
      vi.mocked(
        relationRegistrationClient.acceptTenantInvitation,
      ).mockRejectedValue(
        new ConnectError("invitation token is invalid", code),
      );

      const error = await accept().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ORPCError);
      expect(error).toMatchObject({ code: expected });
      expect((error as ORPCError<string, unknown>).message).not.toContain(
        "invitation token",
      );
      expect(forgetInvitation).not.toHaveBeenCalled();
    },
  );
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

  it("asks the guest service for the guide map of the QR location and returns it as the layout of the guest page", async () => {
    const getGuideMap = vi
      .spyOn(guestPageClient, "getGuideMap")
      .mockResolvedValue(
        create(GetGuideMapResponseSchema, {
          graph: {
            points: [{ pointId: "n_6f8f9cc6", labels: { ja: "ラウンジ" } }],
            groups: [{ groupId: "g_c6f20eff", labels: { ja: "4F" } }],
          },
          layout: { groups: [{ groupId: "g_c6f20eff" }] },
          currentPointId: "n_6f8f9cc6",
        }),
      );

    await expect(
      call(router.guest.getGuideMap, {
        eventId,
        qrLocationId: "a84d0e6c2b9f1735",
      }),
    ).resolves.toEqual({
      graph: {
        points: [{ pointId: "n_6f8f9cc6", labels: { ja: "ラウンジ" } }],
        groups: [{ groupId: "g_c6f20eff", labels: { ja: "4F" } }],
      },
      layout: {
        version: 1,
        groups: [{ groupId: "g_c6f20eff" }],
        objects: [],
        north: 0,
        scale: 0,
      },
      currentPointId: "n_6f8f9cc6",
    });
    expect(getGuideMap).toHaveBeenCalledWith({
      eventId,
      qrLocationId: "a84d0e6c2b9f1735",
    });
  });

  it("passes an event without a guide map to the browser as not found", async () => {
    vi.spyOn(guestPageClient, "getGuideMap").mockRejectedValue(
      new ConnectError("guide map not found", Code.NotFound),
    );

    await expect(
      call(router.guest.getGuideMap, { eventId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
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

describe("observation settings", () => {
  it.each([
    { eventType: EventType.UNSPECIFIED, expected: null },
    { eventType: EventType.SHORT_TERM, expected: "shortTerm" },
    { eventType: EventType.LONG_TERM, expected: "longTerm" },
  ])(
    "returns the settings with event type $eventType as $expected using the console credentials",
    async ({ eventType, expected }) => {
      const get = vi
        .spyOn(consoleObservationSettingsClient, "getObservationSettings")
        .mockResolvedValue(
          create(GetObservationSettingsResponseSchema, {
            settings: { historyWindowDays: 30, eventType },
          }),
        );

      await expect(
        call(router.observation.getSettings, { eventId }),
      ).resolves.toEqual({ historyWindowDays: 30, eventType: expected });
      expect(get).toHaveBeenCalledWith({ eventId });
    },
  );

  it("replaces both settings at once and returns the stored settings", async () => {
    const update = vi
      .spyOn(consoleObservationSettingsClient, "updateObservationSettings")
      .mockResolvedValue(
        create(UpdateObservationSettingsResponseSchema, {
          settings: { historyWindowDays: 14, eventType: EventType.LONG_TERM },
        }),
      );

    await expect(
      call(router.observation.updateSettings, {
        eventId,
        historyWindowDays: 14,
        eventType: "longTerm",
      }),
    ).resolves.toEqual({ historyWindowDays: 14, eventType: "longTerm" });
    expect(update).toHaveBeenCalledWith({
      eventId,
      settings: { historyWindowDays: 14, eventType: EventType.LONG_TERM },
    });
  });

  it.each([
    { historyWindowDays: 0, eventType: "shortTerm" },
    { historyWindowDays: 1.5, eventType: "shortTerm" },
    { historyWindowDays: 2 ** 31, eventType: "shortTerm" },
    { historyWindowDays: 30, eventType: "unspecified" },
    { historyWindowDays: 30, eventType: null },
  ])(
    "rejects %j as a bad request without reaching the gateway",
    async (input) => {
      const update = vi.spyOn(
        consoleObservationSettingsClient,
        "updateObservationSettings",
      );

      await expect(
        call(router.observation.updateSettings, {
          eventId,
          ...input,
        } as never),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("passes settings rejected by the gateway to the browser as a bad request without the server message", async () => {
    vi.spyOn(
      consoleObservationSettingsClient,
      "updateObservationSettings",
    ).mockRejectedValue(
      new ConnectError(
        "history_window_days must be positive",
        Code.InvalidArgument,
      ),
    );

    const error = await call(router.observation.updateSettings, {
      eventId,
      historyWindowDays: 30,
      eventType: "shortTerm",
    }).catch((e: unknown) => e);

    expect(error).toMatchObject({ code: "BAD_REQUEST" });
    expect((error as ORPCError<string, unknown>).message).not.toContain(
      "history_window_days",
    );
  });
});

describe("observation credentials by caller", () => {
  it("lists edge devices with the console credentials", async () => {
    const consoleList = vi
      .spyOn(consoleEdgeDeviceClient, "listEdgeDevices")
      .mockResolvedValue(
        create(ListEdgeDevicesResponseSchema, { devices: [protoDevice] }),
      );
    const edgeList = vi.spyOn(edgeEdgeDeviceClient, "listEdgeDevices");

    await expect(
      call(router.observation.listEdgeDevices, { eventId }),
    ).resolves.toEqual({ devices: [wireDevice] });
    expect(consoleList).toHaveBeenCalledOnce();
    expect(edgeList).not.toHaveBeenCalled();
  });

  it("lists the observation points of the edge device with the edge credentials", async () => {
    const edgeList = vi
      .spyOn(edgeEdgeDeviceClient, "listEdgeDeviceObservationPoints")
      .mockResolvedValue(
        create(ListEdgeDeviceObservationPointsResponseSchema, {
          observationPoints: protoDevice.observationPoints,
        }),
      );
    const consoleList = vi.spyOn(consoleEdgeDeviceClient, "listEdgeDevices");

    await expect(
      call(router.observation.listObservationPoints, {
        eventId,
        edgeDeviceId: "0123456789abcdef",
      }),
    ).resolves.toEqual({ observationPoints: wireDevice.observationPoints });
    expect(edgeList).toHaveBeenCalledWith({
      eventId,
      edgeDeviceId: "0123456789abcdef",
    });
    expect(consoleList).not.toHaveBeenCalled();
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

  it("passes the observation points and heartbeats of an unregistered device to the browser as a rejected precondition", async () => {
    const unregistered = new ConnectError(
      "edge device is unregistered",
      Code.FailedPrecondition,
    );
    vi.spyOn(
      edgeEdgeDeviceClient,
      "listEdgeDeviceObservationPoints",
    ).mockRejectedValue(unregistered);
    vi.spyOn(edgeEdgeDeviceClient, "heartbeat").mockRejectedValue(unregistered);

    await expect(
      call(router.observation.listObservationPoints, {
        eventId,
        edgeDeviceId: "0123456789abcdef",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      call(router.observation.heartbeat, {
        eventId,
        edgeDeviceId: "0123456789abcdef",
        activeObservationPointIds: [],
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("passes measurements from an unregistered device to the browser as a rejected precondition", async () => {
    vi.spyOn(
      edgeMeasurementIngestClient,
      "reportMeasurements",
    ).mockRejectedValue(
      new ConnectError("edge device is unregistered", Code.FailedPrecondition),
    );

    await expect(
      call(router.observation.reportMeasurements, {
        eventId,
        edgeDeviceId: "0123456789abcdef",
        measurements: [],
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
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

  it("answer the settings as unset and echo an update without reaching the gateway in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OBSERVATION_API_MOCKING", "enabled");

    await expect(
      call(router.observation.getSettings, { eventId }),
    ).resolves.toEqual({ historyWindowDays: 30, eventType: null });
    await expect(
      call(router.observation.updateSettings, {
        eventId,
        historyWindowDays: 7,
        eventType: "longTerm",
      }),
    ).resolves.toEqual({ historyWindowDays: 7, eventType: "longTerm" });
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
