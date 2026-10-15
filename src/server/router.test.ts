import { Code, ConnectError } from "@connectrpc/connect";
import { call, ORPCError } from "@orpc/server";
import {
  ElementKind,
  GraphViolationsSchema,
  ViolationKind,
} from "@pj-hoakari/tolo-graph-authoring-client-es/tolo/graph/v1/graph_pb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PLACEHOLDER_GRAPH } from "@/features/graph/placeholderGraph";
import { sampleEdgeDevicesWire } from "@/mocks/fixtures/edges";
import { graphAuthoringClient } from "./graphAuthoring";
import { router } from "./router";

vi.hoisted(() => {
  process.env.GATEWAY_URL = "http://127.0.0.1:9";
});
vi.mock("server-only", () => ({}));
vi.mock(
  "@pj-hoakari/tolo-tenant-management-connect-es/tolo/tenant/v1/tenant_pb",
  () => ({ EventStatus: {}, TenantService: { methods: [] } }),
);

const eventId = "fedcba9876543210";
const [device] = sampleEdgeDevicesWire;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("graph.saveGraph", () => {
  const save = () =>
    call(router.graph.saveGraph, { eventId, graph: PLACEHOLDER_GRAPH });

  it("passes the violations in the error details to the browser as plain values", async () => {
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
    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "invalid graph document",
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
