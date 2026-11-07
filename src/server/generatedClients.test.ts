import { create, toJson } from "@bufbuild/protobuf";
import { RequestConnectionRequestSchema } from "@pj-hoakari/tolo-edge-bridge-client-es/tolo/edgebridge/v1/signaling_pb";
import {
  EdgeDeviceKind,
  EdgeDeviceSchema,
} from "@pj-hoakari/tolo-observation-client-es/tolo/observation/v1/observation_pb";
import { expect, it } from "vitest";

it("resolves the vendored observation schema with device kinds and camera links", () => {
  const device = create(EdgeDeviceSchema, {
    kind: EdgeDeviceKind.OBSERVATION_PAGE,
    cameraLinks: [
      { cameraEdgeDeviceId: "camera", observationPointId: "point" },
    ],
  });
  expect(toJson(EdgeDeviceSchema, device)).toMatchObject({
    kind: "EDGE_DEVICE_KIND_OBSERVATION_PAGE",
    cameraLinks: [
      { cameraEdgeDeviceId: "camera", observationPointId: "point" },
    ],
  });
  expect(EdgeDeviceKind.CAMERA).toBe(2);
});
it("resolves the vendored bridge schema with edge_device_id", () => {
  const request = create(RequestConnectionRequestSchema, {
    edgeDeviceId: "camera",
  });
  expect(
    toJson(RequestConnectionRequestSchema, request, {
      useProtoFieldName: true,
    }),
  ).toEqual({ edge_device_id: "camera" });
});
