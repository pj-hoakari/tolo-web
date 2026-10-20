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
import { graphAuthoringClient } from "./graphAuthoring";
import {
  consoleEdgeDeviceClient,
  edgeEdgeDeviceClient,
  edgeMeasurementIngestClient,
} from "./observation";
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
