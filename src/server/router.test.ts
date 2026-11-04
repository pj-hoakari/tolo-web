import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError } from "@connectrpc/connect";
import { call, ORPCError } from "@orpc/server";
import {
  IssueFirestoreTokenResponseSchema,
  RequestConnectionResponseSchema,
} from "@pj-hoakari/tolo-edge-bridge-client-es/tolo/edgebridge/v1/signaling_pb";
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
  CameraLinkSchema,
  EdgeDeviceKind,
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
import { EventStatus as ProtoEventStatus } from "@pj-hoakari/tolo-tenant-management-connect-es/tolo/tenant/v1/tenant_pb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLACEHOLDER_GRAPH } from "@/features/graph/placeholderGraph";
import { sampleObservationDevicesWire } from "@/mocks/fixtures/edges";
import {
  afterJoinPath,
  getAccessToken,
  getRegistrationToken,
  getViewer,
  requestTenantId,
} from "./auth";
import {
  addCameraToConnectionDelegation,
  connectionDelegationCameraIds,
  connectionEventAccess,
  deleteConnectionDelegationsForCamera,
  deleteConnectionDelegationsForEvent,
  withCameraConnectionAuthorization,
} from "./auth/connection";
import { forgetInvitation, pendingInvitationToken } from "./auth/invitation";
import {
  revokeMachineSessionsForEdge,
  revokeMachineSessionsForEvent,
} from "./auth/machineSessionRevocation";
import { graphAuthoringClient } from "./graphAuthoring";
import { guestPageClient } from "./guest";
import { issueRegistrationToken } from "./idp";
import * as observationModule from "./observation";
import {
  consoleEdgeDeviceClient,
  consoleObservationSettingsClient,
  edgeEdgeDeviceClient,
  edgeMeasurementIngestClient,
} from "./observation";
import { router } from "./router";
import { connectionSignalingClient } from "./signaling";
import {
  relationAdminClient,
  relationRegistrationClient,
  tenantManagementClient,
  tenantRegistrationClient,
} from "./tenantManagement";

vi.hoisted(() => {
  process.env.GATEWAY_URL = "http://127.0.0.1:9";
});
vi.mock("server-only", () => ({}));
vi.mock(
  "@pj-hoakari/tolo-tenant-management-connect-es/tolo/tenant/v1/tenant_pb",
  () => ({
    EventStatus: { DRAFT: 1, OPEN: 2, LOCKED: 3, CLOSED: 4, ARCHIVED: 5 },
    TenantService: { methods: [] },
  }),
);

vi.mock("./tenantManagement", () => ({
  tenantRegistrationClient: {
    startTenantRegistration: vi.fn(),
    claimTenantOwnership: vi.fn(),
  },
  tenantManagementClient: {
    listEvents: vi.fn(),
    createEvent: vi.fn(),
    transitionEventStatus: vi.fn(),
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
  getAccessToken: vi.fn(),
  getRegistrationToken: vi.fn(),
  getViewer: vi.fn(async () => ({
    type: "staff",
    userId: "user-1",
    tenantId: "0123456789abcdef",
  })),
  requestTenantId: vi.fn(),
}));
vi.mock("./auth/connection", () => ({
  addCameraToConnectionDelegation: vi.fn(),
  CONNECTION_ERROR_CODES: {
    authorizationRequired: "CONNECTION_AUTHORIZATION_REQUIRED",
    cameraNotDelegated: "CAMERA_NOT_DELEGATED",
    notConfigured: "CONNECTION_NOT_CONFIGURED",
    refreshFailed: "CONNECTION_REFRESH_FAILED",
    eventAccessFailed: "CONNECTION_EVENT_ACCESS_FAILED",
  },
  connectionDelegationCameraIds: vi.fn(),
  connectionEventAccess: vi.fn(),
  deleteConnectionDelegationsForCamera: vi.fn(),
  deleteConnectionDelegationsForEvent: vi.fn(),
  deleteConnectionDelegationsForPage: vi.fn(),
  withCameraConnectionAuthorization: vi.fn(),
}));
vi.mock("./auth/eventLifecycle", () => ({
  withEventLifecycle: vi.fn((_eventId: string, task: () => Promise<unknown>) =>
    task(),
  ),
}));
vi.mock("./auth/machineSessionRevocation", () => ({
  revokeMachineSessionsForEvent: vi.fn(),
  revokeMachineSessionsForEdge: vi.fn(),
}));
vi.mock("./auth/invitation", () => ({
  forgetInvitation: vi.fn(),
  pendingInvitationToken: vi.fn(),
}));
vi.mock("./idp", () => ({ issueRegistrationToken: vi.fn() }));

const eventId = "fedcba9876543210";
const [device] = sampleObservationDevicesWire;

beforeEach(() => {
  vi.mocked(requestTenantId).mockResolvedValue("0123456789abcdef");
  vi.mocked(tenantManagementClient.listEvents).mockResolvedValue({
    events: [{ eventId, name: "Event", status: ProtoEventStatus.OPEN }],
  } as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.mocked(connectionDelegationCameraIds).mockReset();
  vi.mocked(getViewer).mockResolvedValue({
    type: "staff",
    userId: "user-1",
    tenantId: "0123456789abcdef",
  });
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
  kind: EdgeDeviceKind.OBSERVATION_PAGE,
  online: false,
  lastHeartbeatAt: timestampFromDate(new Date("2026-06-14T10:00:00.000Z")),
  observationPoints: [{ observationPointId: "1111111111111111", name: "受付" }],
});
const wireDevice = {
  edgeDeviceId: "0123456789abcdef",
  name: "受付カメラ",
  kind: "observation_page",
  cameraLinks: [],
  online: false,
  lastHeartbeatAt: "2026-06-14T10:00:00.000Z",
  observationPoints: [{ observationPointId: "1111111111111111", name: "受付" }],
};
const protoCamera = create(EdgeDeviceSchema, {
  edgeDeviceId: "0123456789abcdee",
  name: "ESP32 カメラ",
  kind: EdgeDeviceKind.CAMERA,
  online: true,
  lastHeartbeatAt: timestampFromDate(new Date("2026-06-14T10:00:00.000Z")),
  cameraLinks: [
    {
      cameraEdgeDeviceId: "0123456789abcdee",
      observationPointId: "1111111111111111",
    },
  ],
});
const wireCamera = {
  edgeDeviceId: "0123456789abcdee",
  name: "ESP32 カメラ",
  kind: "camera",
  cameraLinks: [
    {
      cameraEdgeDeviceId: "0123456789abcdee",
      observationPointId: "1111111111111111",
    },
  ],
  online: null,
  lastHeartbeatAt: null,
  observationPoints: [],
};

const protoPageWithCamera = create(EdgeDeviceSchema, {
  ...protoDevice,
  cameraLinks: [
    create(CameraLinkSchema, {
      cameraEdgeDeviceId: protoCamera.edgeDeviceId,
      observationPointId: "1111111111111111",
    }),
  ],
});

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
  const register = (input: {
    name: string;
    kind?: "observation_page" | "camera";
    observationPointNames: string[];
    linkedObservationPointId?: string;
  }) => call(router.observation.registerEdgeDevice, { eventId, ...input });

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
      register({
        name: " 受付カメラ ",
        observationPointNames: [" 受付 "],
        linkedObservationPointId: "",
      }),
    ).resolves.toEqual({
      device: wireDevice,
      observationPagePath: `/event/${eventId}/observation/0123456789abcdef`,
    });
    expect(consoleRegister).toHaveBeenCalledWith({
      eventId,
      name: "受付カメラ",
      observationPointNames: ["受付"],
      kind: EdgeDeviceKind.OBSERVATION_PAGE,
      linkedObservationPointId: "",
    });
    expect(edgeRegister).not.toHaveBeenCalled();
  });

  it("registers a camera with one linked observation point and no point names", async () => {
    vi.mocked(addCameraToConnectionDelegation).mockClear();
    const consoleRegister = vi
      .spyOn(consoleEdgeDeviceClient, "registerEdgeDevice")
      .mockResolvedValue(
        create(RegisterEdgeDeviceResponseSchema, {
          device: protoCamera,
          observationPagePath: "",
        }),
      );
    vi.spyOn(consoleEdgeDeviceClient, "listEdgeDevices").mockResolvedValue(
      create(ListEdgeDevicesResponseSchema, {
        devices: [protoPageWithCamera, protoCamera],
      }),
    );

    await expect(
      register({
        name: " ESP32 カメラ ",
        kind: "camera",
        observationPointNames: [],
        linkedObservationPointId: "1111111111111111",
      }),
    ).resolves.toEqual({ device: wireCamera, observationPagePath: "" });
    expect(consoleRegister).toHaveBeenCalledWith({
      eventId,
      name: "ESP32 カメラ",
      observationPointNames: [],
      kind: EdgeDeviceKind.CAMERA,
      linkedObservationPointId: "1111111111111111",
    });
    expect(addCameraToConnectionDelegation).toHaveBeenCalledWith(
      eventId,
      protoDevice.edgeDeviceId,
      protoCamera.edgeDeviceId,
    );
  });

  it("registers a camera without adding a delegation when no observation page owns it", async () => {
    vi.mocked(addCameraToConnectionDelegation).mockClear();
    vi.spyOn(consoleEdgeDeviceClient, "registerEdgeDevice").mockResolvedValue(
      create(RegisterEdgeDeviceResponseSchema, {
        device: protoCamera,
        observationPagePath: "",
      }),
    );
    vi.spyOn(consoleEdgeDeviceClient, "listEdgeDevices").mockResolvedValue(
      create(ListEdgeDevicesResponseSchema, { devices: [protoCamera] }),
    );

    await expect(
      register({
        name: "ESP32 カメラ",
        kind: "camera",
        observationPointNames: [],
        linkedObservationPointId: "1111111111111111",
      }),
    ).resolves.toEqual({ device: wireCamera, observationPagePath: "" });
    expect(addCameraToConnectionDelegation).not.toHaveBeenCalled();
  });

  it.each([
    { name: " ", observationPointNames: ["受付"] },
    { name: "受付カメラ", observationPointNames: [] },
    { name: "受付カメラ", observationPointNames: [" "] },
    { name: "受付カメラ", observationPointNames: ["受付", " 受付"] },
    {
      name: "ESP32 カメラ",
      kind: "camera",
      observationPointNames: ["受付"],
      linkedObservationPointId: "1111111111111111",
    },
    {
      name: "ESP32 カメラ",
      kind: "camera",
      observationPointNames: [],
    },
    {
      name: "受付カメラ",
      kind: "observation_page",
      observationPointNames: ["受付"],
      linkedObservationPointId: "1111111111111111",
    },
  ])(
    "rejects %j as a bad request without reaching the gateway",
    async (input) => {
      const consoleRegister = vi.spyOn(
        consoleEdgeDeviceClient,
        "registerEdgeDevice",
      );

      await expect(register(input as never)).rejects.toMatchObject({
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
  const unregister = (edgeDeviceId = "0123456789abcdef") =>
    call(router.observation.unregisterEdgeDevice, {
      eventId,
      edgeDeviceId,
    });

  const stubIdp = () => {
    vi.stubEnv("AUTH_IDP_ISSUER", "https://idp.test");
    vi.stubEnv("AUTH_IDP_CLIENT_ID", "console-ui");
    vi.stubEnv("AUTH_IDP_CLIENT_SECRET", "console-secret");
    vi.mocked(getAccessToken).mockResolvedValue("staff-token");
  };

  it("unregisters an observation page with the console credentials without revoking a device authorization", async () => {
    const consoleList = vi
      .spyOn(consoleEdgeDeviceClient, "listEdgeDevices")
      .mockResolvedValue(
        create(ListEdgeDevicesResponseSchema, { devices: [protoDevice] }),
      );
    const consoleUnregister = vi
      .spyOn(consoleEdgeDeviceClient, "unregisterEdgeDevice")
      .mockResolvedValue(
        create(UnregisterEdgeDeviceResponseSchema, { device: protoDevice }),
      );
    const edgeUnregister = vi.spyOn(
      edgeEdgeDeviceClient,
      "unregisterEdgeDevice",
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(unregister()).resolves.toBeUndefined();
    expect(consoleList).toHaveBeenCalledWith({ eventId });
    expect(consoleUnregister).toHaveBeenCalledWith({
      eventId,
      edgeDeviceId: "0123456789abcdef",
    });
    expect(edgeUnregister).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("revokes the camera device authorization before unregistering it", async () => {
    stubIdp();
    const order: string[] = [];
    vi.spyOn(consoleEdgeDeviceClient, "listEdgeDevices").mockImplementation(
      async () => {
        order.push("list");
        return create(ListEdgeDevicesResponseSchema, {
          devices: [protoCamera],
        });
      },
    );
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => {
        order.push("revoke");
        return new Response(null, { status: 204 });
      });
    const consoleUnregister = vi
      .spyOn(consoleEdgeDeviceClient, "unregisterEdgeDevice")
      .mockImplementation(async () => {
        order.push("unregister");
        return create(UnregisterEdgeDeviceResponseSchema, {
          device: protoCamera,
        });
      });

    await expect(unregister("0123456789abcdee")).resolves.toBeUndefined();
    expect(order).toEqual(["list", "revoke", "unregister"]);
    expect(revokeMachineSessionsForEdge).toHaveBeenCalledWith(
      eventId,
      "0123456789abcdee",
    );
    expect(deleteConnectionDelegationsForCamera).toHaveBeenCalledWith(
      eventId,
      "0123456789abcdee",
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://idp.test/api/device-authorization/revoke",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          event_id: eventId,
          edge_device_id: "0123456789abcdee",
          permanent: true,
        }),
      }),
    );
    expect(consoleUnregister).toHaveBeenCalledOnce();
  });

  it("does not unregister a camera when the device authorization cannot be revoked", async () => {
    stubIdp();
    const order: string[] = [];
    vi.spyOn(consoleEdgeDeviceClient, "listEdgeDevices").mockImplementation(
      async () => {
        order.push("list");
        return create(ListEdgeDevicesResponseSchema, {
          devices: [protoCamera],
        });
      },
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      order.push("revoke");
      return new Response("idp unavailable", { status: 503 });
    });
    const consoleUnregister = vi.spyOn(
      consoleEdgeDeviceClient,
      "unregisterEdgeDevice",
    );

    await expect(unregister("0123456789abcdee")).rejects.toMatchObject({
      code: "BAD_GATEWAY",
    });
    expect(order).toEqual(["list", "revoke"]);
    expect(consoleUnregister).not.toHaveBeenCalled();
  });

  it("passes an already unregistered device to the browser as a rejected precondition", async () => {
    vi.spyOn(consoleEdgeDeviceClient, "listEdgeDevices").mockResolvedValue(
      create(ListEdgeDevicesResponseSchema, { devices: [protoDevice] }),
    );
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

  it("maps camera devices with their kind, camera links, and no online value", async () => {
    vi.spyOn(consoleEdgeDeviceClient, "listEdgeDevices").mockResolvedValue(
      create(ListEdgeDevicesResponseSchema, {
        devices: [protoDevice, protoCamera],
      }),
    );

    await expect(
      call(router.observation.listEdgeDevices, { eventId }),
    ).resolves.toEqual({ devices: [wireDevice, wireCamera] });
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

describe("tenant.archiveEvent camera revocation", () => {
  const stubIdp = () => {
    vi.stubEnv("AUTH_IDP_ISSUER", "https://idp.test");
    vi.stubEnv("AUTH_IDP_CLIENT_ID", "console-ui");
    vi.stubEnv("AUTH_IDP_CLIENT_SECRET", "console-secret");
    vi.mocked(getAccessToken).mockResolvedValue("staff-token");
  };

  const camera = (edgeDeviceId: string) =>
    create(EdgeDeviceSchema, {
      edgeDeviceId,
      name: "ESP32 カメラ",
      kind: EdgeDeviceKind.CAMERA,
    });

  const transitioned = (status: number) =>
    vi.mocked(tenantManagementClient.transitionEventStatus).mockResolvedValue({
      event: { eventId, name: "Event", status },
    } as never);

  it("revokes every camera grant before archiving the event", async () => {
    stubIdp();
    const order: string[] = [];
    vi.spyOn(consoleEdgeDeviceClient, "listEdgeDevices").mockImplementation(
      async () => {
        order.push("list");
        return create(ListEdgeDevicesResponseSchema, {
          devices: [
            protoDevice,
            camera("0123456789abcdee"),
            camera("0123456789abcdff"),
          ],
        });
      },
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      order.push("revoke");
      return new Response(null, { status: 204 });
    });
    vi.mocked(deleteConnectionDelegationsForEvent).mockImplementation(
      async () => {
        order.push("delete");
      },
    );
    transitioned(5);
    vi.mocked(tenantManagementClient.transitionEventStatus).mockImplementation(
      async () => {
        order.push("transition");
        return {
          event: { eventId, name: "Event", status: 5 },
        } as never;
      },
    );

    await expect(
      call(router.tenant.archiveEvent, { eventId }),
    ).resolves.toEqual({ eventId, name: "Event", status: "archived" });
    expect(order).toEqual(["list", "revoke", "revoke", "delete", "transition"]);
    expect(revokeMachineSessionsForEvent).toHaveBeenCalledWith(eventId);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://idp.test/api/device-authorization/revoke",
      expect.objectContaining({
        body: JSON.stringify({
          event_id: eventId,
          edge_device_id: "0123456789abcdee",
          permanent: true,
        }),
      }),
    );
  });

  it("does not archive the event when any camera grant cannot be revoked", async () => {
    stubIdp();
    const order: string[] = [];
    vi.spyOn(consoleEdgeDeviceClient, "listEdgeDevices").mockImplementation(
      async () => {
        order.push("list");
        return create(ListEdgeDevicesResponseSchema, {
          devices: [camera("0123456789abcdee"), camera("0123456789abcdff")],
        });
      },
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      order.push("revoke");
      return new Response("idp unavailable", { status: 503 });
    });
    const transition = vi.mocked(tenantManagementClient.transitionEventStatus);

    await expect(
      call(router.tenant.archiveEvent, { eventId }),
    ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    expect(order).toEqual(["list", "revoke"]);
    expect(transition).not.toHaveBeenCalled();
  });

  it("does not re-authorize cameras when restoring an archived event", async () => {
    const list = vi.spyOn(consoleEdgeDeviceClient, "listEdgeDevices");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    transitioned(4);

    await expect(
      call(router.tenant.restoreEvent, { eventId }),
    ).resolves.toEqual({ eventId, name: "Event", status: "closed" });
    expect(list).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("camera", () => {
  const stubIdp = () => {
    vi.stubEnv("AUTH_IDP_ISSUER", "https://idp.test");
    vi.stubEnv("AUTH_IDP_CLIENT_ID", "console-ui");
    vi.stubEnv("AUTH_IDP_CLIENT_SECRET", "console-secret");
    vi.mocked(getAccessToken).mockResolvedValue("staff-token");
  };

  const approvableEvent = (status = ProtoEventStatus.OPEN) => {
    vi.mocked(requestTenantId).mockResolvedValue("0123456789abcdef");
    vi.mocked(tenantManagementClient.listEvents).mockResolvedValue({
      events: [{ eventId, name: "Event", status }],
    } as never);
  };

  const listCameras = (devices = [protoCamera]) =>
    vi
      .spyOn(consoleEdgeDeviceClient, "listEdgeDevices")
      .mockResolvedValue(create(ListEdgeDevicesResponseSchema, { devices }));

  it("approves a registered camera after checking that it belongs to the event", async () => {
    stubIdp();
    approvableEvent();
    listCameras();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      call(router.camera.approveDeviceAuthorization, {
        eventId,
        edgeDeviceId: "0123456789abcdee",
        userCode: "ABCD-EFGH",
      }),
    ).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://idp.test/api/device-authorization/approve",
      expect.objectContaining({
        body: JSON.stringify({
          user_code: "ABCD-EFGH",
          event_id: eventId,
          edge_device_id: "0123456789abcdee",
        }),
      }),
    );
  });

  it("approves with an explicit reapproval when the staff asks for it", async () => {
    stubIdp();
    approvableEvent();
    listCameras();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await call(router.camera.approveDeviceAuthorization, {
      eventId,
      edgeDeviceId: "0123456789abcdee",
      userCode: "ABCD-EFGH",
      reapproval: true,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://idp.test/api/device-authorization/approve",
      expect.objectContaining({
        body: JSON.stringify({
          user_code: "ABCD-EFGH",
          event_id: eventId,
          edge_device_id: "0123456789abcdee",
          reapproval: true,
        }),
      }),
    );
  });

  it.each([
    ["closed", ProtoEventStatus.CLOSED],
    ["archived", ProtoEventStatus.ARCHIVED],
  ])("refuses to approve a camera in a %s event", async (_, status) => {
    stubIdp();
    approvableEvent(status);
    const list = listCameras();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      call(router.camera.approveDeviceAuthorization, {
        eventId,
        edgeDeviceId: "0123456789abcdee",
        userCode: "ABCD-EFGH",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(list).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses to approve when the event state cannot be fetched", async () => {
    stubIdp();
    vi.mocked(requestTenantId).mockResolvedValue("0123456789abcdef");
    vi.mocked(tenantManagementClient.listEvents).mockRejectedValue(
      new ConnectError("tenant-management unavailable", Code.Unavailable),
    );
    const list = listCameras();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      call(router.camera.approveDeviceAuthorization, {
        eventId,
        edgeDeviceId: "0123456789abcdee",
        userCode: "ABCD-EFGH",
      }),
    ).rejects.toBeInstanceOf(ConnectError);
    expect(list).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses to approve an observation page device", async () => {
    stubIdp();
    approvableEvent();
    listCameras([protoDevice]);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      call(router.camera.approveDeviceAuthorization, {
        eventId,
        edgeDeviceId: "0123456789abcdef",
        userCode: "ABCD-EFGH",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("revokes a registered camera permanently", async () => {
    stubIdp();
    listCameras();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      call(router.camera.revokeDeviceAuthorization, {
        eventId,
        edgeDeviceId: "0123456789abcdee",
      }),
    ).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://idp.test/api/device-authorization/revoke",
      expect.objectContaining({
        body: JSON.stringify({
          event_id: eventId,
          edge_device_id: "0123456789abcdee",
          permanent: true,
        }),
      }),
    );
    expect(deleteConnectionDelegationsForCamera).toHaveBeenCalledWith(
      eventId,
      "0123456789abcdee",
    );
  });

  it("stops a registered camera temporarily without unregistering it", async () => {
    stubIdp();
    listCameras();
    const unregister = vi.spyOn(
      consoleEdgeDeviceClient,
      "unregisterEdgeDevice",
    );
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      call(router.camera.stopDeviceAuthorization, {
        eventId,
        edgeDeviceId: "0123456789abcdee",
      }),
    ).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://idp.test/api/device-authorization/revoke",
      expect.objectContaining({
        body: JSON.stringify({
          event_id: eventId,
          edge_device_id: "0123456789abcdee",
          permanent: false,
        }),
      }),
    );
    expect(unregister).not.toHaveBeenCalled();
    expect(deleteConnectionDelegationsForCamera).toHaveBeenCalledWith(
      eventId,
      "0123456789abcdee",
    );
  });

  it("refuses to revoke a camera that is not registered in the event", async () => {
    stubIdp();
    listCameras([protoDevice]);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      call(router.camera.revokeDeviceAuthorization, {
        eventId,
        edgeDeviceId: "0123456789abcdee",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses to revoke a device whose kind is not a camera", async () => {
    stubIdp();
    listCameras([protoDevice]);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      call(router.camera.stopDeviceAuthorization, {
        eventId,
        edgeDeviceId: "0123456789abcdef",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses to revoke when the staff has no event access", async () => {
    stubIdp();
    vi.spyOn(consoleEdgeDeviceClient, "listEdgeDevices").mockRejectedValue(
      new ConnectError("event role is required", Code.PermissionDenied),
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      call(router.camera.revokeDeviceAuthorization, {
        eventId,
        edgeDeviceId: "0123456789abcdee",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns non-secret provisioning defaults", async () => {
    vi.stubEnv("SIGNALING_PUBLIC_URL", "https://signaling.example");
    vi.stubEnv("FIREBASE_PROJECT_ID", "project-1");
    vi.stubEnv("FIREBASE_API_KEY", "api-key-1");
    vi.stubEnv("FIRESTORE_EMULATOR_HOST", "firestore:8080");
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "auth:9099");
    vi.stubEnv("AUTH_IDP_ISSUER", "https://idp.test/");
    vi.stubEnv("AUTH_IDP_CLIENT_SECRET", "must-not-leak");

    await expect(
      call(router.camera.provisioningDefaults, undefined),
    ).resolves.toEqual({
      signalingUrl: "https://signaling.example",
      idpUrl: "https://idp.test",
      firebaseProjectId: "project-1",
      firebaseApiKey: "api-key-1",
      firestoreEmulatorHost: "firestore:8080",
      firebaseAuthEmulatorHost: "auth:9099",
    });
  });
});

describe("signaling.requestCameraConnection", () => {
  const expiresAt = new Date("2026-06-14T10:05:00.000Z");

  const stubs = (devices = [protoPageWithCamera, protoCamera]) => {
    vi.mocked(requestTenantId).mockResolvedValue("0123456789abcdef");
    vi.mocked(connectionEventAccess).mockResolvedValue("connection-token");
    vi.mocked(withCameraConnectionAuthorization).mockImplementation(
      async (_tenantId, _eventId, _pageEdgeDeviceId, _cameraEdgeId, task) =>
        task("connection-token"),
    );
    const list = vi
      .spyOn(consoleEdgeDeviceClient, "listEdgeDevices")
      .mockResolvedValue(create(ListEdgeDevicesResponseSchema, { devices }));
    const request = vi
      .spyOn(connectionSignalingClient, "requestConnection")
      .mockResolvedValue(
        create(RequestConnectionResponseSchema, { sessionId: "session-1" }),
      );
    const issue = vi
      .spyOn(connectionSignalingClient, "issueFirestoreToken")
      .mockResolvedValue(
        create(IssueFirestoreTokenResponseSchema, {
          firebaseCustomToken: "bound-custom-token",
          expiresAt: timestampFromDate(expiresAt),
        }),
      );
    return { list, request, issue };
  };

  it("creates a session for a linked camera and returns only the bound custom token", async () => {
    const { request, issue } = stubs();

    const result = await call(router.signaling.requestCameraConnection, {
      eventId,
      pageEdgeDeviceId: protoDevice.edgeDeviceId,
      cameraEdgeId: protoCamera.edgeDeviceId,
    });

    expect(result).toEqual({
      sessionId: "session-1",
      firestoreToken: "bound-custom-token",
      expiresAt,
    });
    expect(Object.keys(result).sort()).toEqual([
      "expiresAt",
      "firestoreToken",
      "sessionId",
    ]);
    expect(withCameraConnectionAuthorization).toHaveBeenCalledWith(
      "0123456789abcdef",
      eventId,
      protoDevice.edgeDeviceId,
      protoCamera.edgeDeviceId,
      expect.any(Function),
    );
    expect(request).toHaveBeenCalledWith(
      { edgeDeviceId: protoCamera.edgeDeviceId },
      expect.anything(),
    );
    expect(issue).toHaveBeenCalledWith(
      {
        edgeDeviceId: protoCamera.edgeDeviceId,
        sessionId: "session-1",
      },
      expect.anything(),
    );
  });

  it("asks a staff viewer to reauthorize when the stored authorization is missing", async () => {
    const { request, issue } = stubs();
    vi.mocked(withCameraConnectionAuthorization).mockRejectedValue(
      new ORPCError("PRECONDITION_FAILED", {
        data: { code: "CONNECTION_AUTHORIZATION_REQUIRED" },
      }),
    );

    await expect(
      call(router.signaling.requestCameraConnection, {
        eventId,
        pageEdgeDeviceId: protoDevice.edgeDeviceId,
        cameraEdgeId: protoCamera.edgeDeviceId,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: {
        code: "CONNECTION_AUTHORIZATION_REQUIRED",
        viewerType: "staff",
        eventId,
        pageEdgeDeviceId: protoDevice.edgeDeviceId,
        cameraEdgeDeviceId: protoCamera.edgeDeviceId,
      },
    });
    expect(request).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  it("asks for reauthorization when a linked camera is missing from the stored delegation", async () => {
    const { request, issue } = stubs();
    vi.mocked(withCameraConnectionAuthorization).mockRejectedValue(
      new ORPCError("PRECONDITION_FAILED", {
        data: { code: "CAMERA_NOT_DELEGATED" },
      }),
    );

    await expect(
      call(router.signaling.requestCameraConnection, {
        eventId,
        pageEdgeDeviceId: protoDevice.edgeDeviceId,
        cameraEdgeId: protoCamera.edgeDeviceId,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: {
        code: "CONNECTION_AUTHORIZATION_REQUIRED",
        viewerType: "staff",
        eventId,
        pageEdgeDeviceId: protoDevice.edgeDeviceId,
        cameraEdgeDeviceId: protoCamera.edgeDeviceId,
      },
    });
    expect(request).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  it("asks a machine viewer to have staff reauthorize without starting a connection", async () => {
    const { request, issue } = stubs();
    vi.mocked(getViewer).mockResolvedValue({
      type: "machine",
      userId: "user-1",
      tenantId: "0123456789abcdef",
      eventId,
      edgeDeviceId: protoDevice.edgeDeviceId,
    });
    vi.spyOn(
      observationModule,
      "listEdgeDevicesWithAccessToken",
    ).mockResolvedValue(
      create(ListEdgeDevicesResponseSchema, {
        devices: [protoPageWithCamera, protoCamera],
      }),
    );
    vi.mocked(withCameraConnectionAuthorization).mockRejectedValue(
      new ORPCError("PRECONDITION_FAILED", {
        data: { code: "CONNECTION_AUTHORIZATION_REQUIRED" },
      }),
    );

    await expect(
      call(router.signaling.requestCameraConnection, {
        eventId,
        pageEdgeDeviceId: protoDevice.edgeDeviceId,
        cameraEdgeId: protoCamera.edgeDeviceId,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: {
        code: "CONNECTION_AUTHORIZATION_REQUIRED",
        viewerType: "machine",
        eventId,
        pageEdgeDeviceId: protoDevice.edgeDeviceId,
        cameraEdgeDeviceId: protoCamera.edgeDeviceId,
      },
    });
    expect(request).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  it("rejects a camera missing from the event before calling Edge Bridge", async () => {
    const { request, issue } = stubs([protoDevice, protoCamera]);

    await expect(
      call(router.signaling.requestCameraConnection, {
        eventId,
        pageEdgeDeviceId: protoDevice.edgeDeviceId,
        cameraEdgeId: "0123456789abcdff",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(request).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  it("rejects a camera that exists but is not listed in the page's cameraLinks", async () => {
    const otherCamera = create(EdgeDeviceSchema, {
      ...protoCamera,
      edgeDeviceId: "0123456789abcdff",
    });
    const page = create(EdgeDeviceSchema, {
      ...protoDevice,
      cameraLinks: [
        create(CameraLinkSchema, {
          cameraEdgeDeviceId: otherCamera.edgeDeviceId,
          observationPointId: "1111111111111111",
        }),
      ],
    });
    const { request, issue } = stubs([page, protoCamera, otherCamera]);

    await expect(
      call(router.signaling.requestCameraConnection, {
        eventId,
        pageEdgeDeviceId: page.edgeDeviceId,
        cameraEdgeId: protoCamera.edgeDeviceId,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: {
        code: "CAMERA_NOT_DELEGATED",
        viewerType: "staff",
        eventId,
        pageEdgeDeviceId: page.edgeDeviceId,
        cameraEdgeDeviceId: protoCamera.edgeDeviceId,
      },
    });
    expect(request).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  it("rejects a page edge device that is missing from the event", async () => {
    const { request, issue } = stubs([protoCamera]);

    await expect(
      call(router.signaling.requestCameraConnection, {
        eventId,
        pageEdgeDeviceId: protoDevice.edgeDeviceId,
        cameraEdgeId: protoCamera.edgeDeviceId,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(request).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  it("rejects a page edge device whose kind is a camera", async () => {
    const { request, issue } = stubs([protoCamera]);

    await expect(
      call(router.signaling.requestCameraConnection, {
        eventId,
        pageEdgeDeviceId: protoCamera.edgeDeviceId,
        cameraEdgeId: protoCamera.edgeDeviceId,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(request).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  it("rejects a camera edge device whose kind is an observation page", async () => {
    const { request, issue } = stubs([protoPageWithCamera]);

    await expect(
      call(router.signaling.requestCameraConnection, {
        eventId,
        pageEdgeDeviceId: protoPageWithCamera.edgeDeviceId,
        cameraEdgeId: protoPageWithCamera.edgeDeviceId,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(request).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });
});

describe("camera.listDelegatedCameras", () => {
  const linkedCamera = protoCamera;
  const unlinkedCamera = create(EdgeDeviceSchema, {
    edgeDeviceId: "0123456789abcdff",
    name: "別のカメラ",
    kind: EdgeDeviceKind.CAMERA,
  });

  it("returns only the page's linked cameras to staff through the console token", async () => {
    vi.mocked(requestTenantId).mockResolvedValue("0123456789abcdef");
    vi.mocked(connectionDelegationCameraIds).mockResolvedValue([
      linkedCamera.edgeDeviceId,
    ]);
    const list = vi
      .spyOn(consoleEdgeDeviceClient, "listEdgeDevices")
      .mockResolvedValue(
        create(ListEdgeDevicesResponseSchema, {
          devices: [protoPageWithCamera, linkedCamera, unlinkedCamera],
        }),
      );

    await expect(
      call(router.camera.listDelegatedCameras, {
        eventId,
        pageEdgeDeviceId: protoPageWithCamera.edgeDeviceId,
      }),
    ).resolves.toEqual({
      cameras: [
        {
          ...wireCamera,
          connectionAuthorized: true,
          observationPointId: "1111111111111111",
        },
      ],
    });
    expect(list).toHaveBeenCalledOnce();
  });

  it("uses the connection authorization's events.read token for a machine session", async () => {
    vi.mocked(requestTenantId).mockResolvedValue("0123456789abcdef");
    vi.mocked(getViewer).mockResolvedValue({
      type: "machine",
      userId: "user-1",
      tenantId: "0123456789abcdef",
      eventId,
      edgeDeviceId: protoPageWithCamera.edgeDeviceId,
    });
    vi.mocked(connectionEventAccess).mockResolvedValue("connection-token");
    vi.mocked(connectionDelegationCameraIds).mockResolvedValue([
      linkedCamera.edgeDeviceId,
    ]);
    const list = vi
      .spyOn(consoleEdgeDeviceClient, "listEdgeDevices")
      .mockResolvedValue(
        create(ListEdgeDevicesResponseSchema, {
          devices: [protoPageWithCamera, linkedCamera, unlinkedCamera],
        }),
      );
    const delegated = vi
      .spyOn(observationModule, "listEdgeDevicesWithAccessToken")
      .mockResolvedValue(
        create(ListEdgeDevicesResponseSchema, {
          devices: [protoPageWithCamera, linkedCamera, unlinkedCamera],
        }),
      );

    await expect(
      call(router.camera.listDelegatedCameras, {
        eventId,
        pageEdgeDeviceId: protoPageWithCamera.edgeDeviceId,
      }),
    ).resolves.toEqual({
      cameras: [
        {
          ...wireCamera,
          connectionAuthorized: true,
          observationPointId: "1111111111111111",
        },
      ],
    });
    expect(delegated).toHaveBeenCalledWith(eventId, "connection-token");
    expect(list).not.toHaveBeenCalled();
  });

  it("refuses a machine session that asks for another page", async () => {
    vi.mocked(requestTenantId).mockResolvedValue("0123456789abcdef");
    vi.mocked(getViewer).mockResolvedValue({
      type: "machine",
      userId: "user-1",
      tenantId: "0123456789abcdef",
      eventId,
      edgeDeviceId: "aaaaaaaaaaaaaaaa",
    });

    await expect(
      call(router.camera.listDelegatedCameras, {
        eventId,
        pageEdgeDeviceId: protoPageWithCamera.edgeDeviceId,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("passes a missing connection authorization to the caller", async () => {
    vi.mocked(requestTenantId).mockResolvedValue("0123456789abcdef");
    vi.mocked(getViewer).mockResolvedValue({
      type: "machine",
      userId: "user-1",
      tenantId: "0123456789abcdef",
      eventId,
      edgeDeviceId: protoPageWithCamera.edgeDeviceId,
    });
    vi.mocked(connectionEventAccess).mockRejectedValue(
      new ORPCError("PRECONDITION_FAILED", {
        data: { code: "CONNECTION_AUTHORIZATION_REQUIRED" },
      }),
    );

    await expect(
      call(router.camera.listDelegatedCameras, {
        eventId,
        pageEdgeDeviceId: protoPageWithCamera.edgeDeviceId,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: {
        code: "CONNECTION_AUTHORIZATION_REQUIRED",
        viewerType: "machine",
        eventId,
        pageEdgeDeviceId: protoPageWithCamera.edgeDeviceId,
      },
    });
  });

  it("returns both linked cameras with independent connection authorization", async () => {
    vi.mocked(requestTenantId).mockResolvedValue("0123456789abcdef");
    vi.mocked(connectionDelegationCameraIds).mockResolvedValue([
      linkedCamera.edgeDeviceId,
    ]);
    const page = create(EdgeDeviceSchema, {
      ...protoPageWithCamera,
      cameraLinks: [
        ...protoPageWithCamera.cameraLinks,
        {
          ...protoPageWithCamera.cameraLinks[0],
          cameraEdgeDeviceId: unlinkedCamera.edgeDeviceId,
          observationPointId: "2222222222222222",
        },
      ],
    });
    vi.spyOn(consoleEdgeDeviceClient, "listEdgeDevices").mockResolvedValue(
      create(ListEdgeDevicesResponseSchema, {
        devices: [page, linkedCamera, unlinkedCamera],
      }),
    );
    const { cameras } = await call(router.camera.listDelegatedCameras, {
      eventId,
      pageEdgeDeviceId: page.edgeDeviceId,
    });
    expect(
      cameras.map(({ edgeDeviceId, connectionAuthorized }) => ({
        edgeDeviceId,
        connectionAuthorized,
      })),
    ).toEqual([
      { edgeDeviceId: linkedCamera.edgeDeviceId, connectionAuthorized: true },
      {
        edgeDeviceId: unlinkedCamera.edgeDeviceId,
        connectionAuthorized: false,
      },
    ]);
  });

  it("marks a missing staff delegation unauthorized without rejecting other cameras", async () => {
    vi.mocked(requestTenantId).mockResolvedValue("0123456789abcdef");
    vi.mocked(connectionDelegationCameraIds).mockResolvedValue([
      unlinkedCamera.edgeDeviceId,
    ]);
    vi.spyOn(consoleEdgeDeviceClient, "listEdgeDevices").mockResolvedValue(
      create(ListEdgeDevicesResponseSchema, {
        devices: [protoPageWithCamera, linkedCamera, unlinkedCamera],
      }),
    );

    await expect(
      call(router.camera.listDelegatedCameras, {
        eventId,
        pageEdgeDeviceId: protoPageWithCamera.edgeDeviceId,
      }),
    ).resolves.toMatchObject({
      cameras: [
        {
          edgeDeviceId: linkedCamera.edgeDeviceId,
          connectionAuthorized: false,
        },
      ],
    });
  });

  it("asks a staff viewer to reauthorize when no connection authorization is stored", async () => {
    vi.mocked(requestTenantId).mockResolvedValue("0123456789abcdef");
    vi.mocked(connectionDelegationCameraIds).mockResolvedValue(null);
    vi.spyOn(consoleEdgeDeviceClient, "listEdgeDevices").mockResolvedValue(
      create(ListEdgeDevicesResponseSchema, {
        devices: [protoPageWithCamera, linkedCamera, unlinkedCamera],
      }),
    );

    await expect(
      call(router.camera.listDelegatedCameras, {
        eventId,
        pageEdgeDeviceId: protoPageWithCamera.edgeDeviceId,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: {
        code: "CONNECTION_AUTHORIZATION_REQUIRED",
        viewerType: "staff",
        eventId,
        pageEdgeDeviceId: protoPageWithCamera.edgeDeviceId,
      },
    });
  });

  it("marks a missing machine delegation unauthorized without rejecting the list", async () => {
    vi.mocked(requestTenantId).mockResolvedValue("0123456789abcdef");
    vi.mocked(getViewer).mockResolvedValue({
      type: "machine",
      userId: "user-1",
      tenantId: "0123456789abcdef",
      eventId,
      edgeDeviceId: protoPageWithCamera.edgeDeviceId,
    });
    vi.mocked(connectionEventAccess).mockResolvedValue("connection-token");
    vi.mocked(connectionDelegationCameraIds).mockResolvedValue([
      unlinkedCamera.edgeDeviceId,
    ]);
    vi.spyOn(
      observationModule,
      "listEdgeDevicesWithAccessToken",
    ).mockResolvedValue(
      create(ListEdgeDevicesResponseSchema, {
        devices: [protoPageWithCamera, linkedCamera, unlinkedCamera],
      }),
    );

    await expect(
      call(router.camera.listDelegatedCameras, {
        eventId,
        pageEdgeDeviceId: protoPageWithCamera.edgeDeviceId,
      }),
    ).resolves.toMatchObject({
      cameras: [
        {
          edgeDeviceId: linkedCamera.edgeDeviceId,
          connectionAuthorized: false,
        },
      ],
    });
  });
});

describe("machine session procedure allowlist", () => {
  const machine = (edgeDeviceId = protoPageWithCamera.edgeDeviceId) =>
    vi.mocked(getViewer).mockResolvedValue({
      type: "machine",
      userId: "user-1",
      tenantId: "0123456789abcdef",
      eventId,
      edgeDeviceId,
    });

  it("refuses ListEdgeDevices even though the device is in the session", async () => {
    machine();
    const list = vi.spyOn(consoleEdgeDeviceClient, "listEdgeDevices");

    await expect(
      call(router.observation.listEdgeDevices, { eventId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(list).not.toHaveBeenCalled();
  });

  it("refuses a camera connection for another observation page", async () => {
    machine();
    const list = vi.spyOn(consoleEdgeDeviceClient, "listEdgeDevices");

    await expect(
      call(router.signaling.requestCameraConnection, {
        eventId,
        pageEdgeDeviceId: "aaaaaaaaaaaaaaaa",
        cameraEdgeId: protoCamera.edgeDeviceId,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(list).not.toHaveBeenCalled();
  });
});

describe("observation procedures with OBSERVATION_API_MOCKING", () => {
  it("answer with the sample edge devices without reaching the gateway in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OBSERVATION_API_MOCKING", "enabled");

    await expect(
      call(router.observation.listEdgeDevices, { eventId }),
    ).resolves.toEqual({ devices: sampleObservationDevicesWire });
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
