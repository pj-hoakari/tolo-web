import "server-only";

import { EdgeDeviceKind as ProtoEdgeDeviceKind } from "@pj-hoakari/tolo-observation-client-es/tolo/observation/v1/observation_pb";
import { sampleObservationDevicesWire } from "@/mocks/fixtures/edges";
import { consoleEdgeDeviceClient } from "./observation";

export type DelegationCameraKind = "observation_page" | "camera";

export interface DelegationDevice {
  edgeDeviceId: string;
  kind: DelegationCameraKind;
  cameraLinks: {
    cameraEdgeDeviceId: string;
    observationPointId: string;
  }[];
}

export function observationMocking(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.OBSERVATION_API_MOCKING === "enabled"
  );
}

function toKind(kind: ProtoEdgeDeviceKind): DelegationCameraKind {
  return kind === ProtoEdgeDeviceKind.CAMERA ? "camera" : "observation_page";
}

async function delegationDevices(eventId: string): Promise<DelegationDevice[]> {
  if (observationMocking()) return sampleObservationDevicesWire;
  const response = await consoleEdgeDeviceClient.listEdgeDevices({ eventId });
  return response.devices.map((device) => ({
    edgeDeviceId: device.edgeDeviceId,
    kind: toKind(device.kind),
    cameraLinks: device.cameraLinks.map((link) => ({
      cameraEdgeDeviceId: link.cameraEdgeDeviceId,
      observationPointId: link.observationPointId,
    })),
  }));
}

/**
 * 観測ページ端末の cameraLinks に含まれるカメラだけを返す。ページが存在しない、
 * または観測ページでない場合は null を返す。
 */
export async function delegatedPageCameras(
  eventId: string,
  pageEdgeDeviceId: string,
): Promise<string[] | null> {
  const devices = await delegationDevices(eventId);
  const page = devices.find(
    (device) => device.edgeDeviceId === pageEdgeDeviceId,
  );
  if (page?.kind !== "observation_page") return null;
  return [
    ...new Set(
      page.cameraLinks.map((link) => link.cameraEdgeDeviceId).filter(Boolean),
    ),
  ];
}

/**
 * カメラを cameraLinks に持つ観測ページ端末を返す。カメラが登録されていない
 * 場合は null を返す。
 */
export async function cameraPageEdgeDeviceId(
  eventId: string,
  cameraEdgeDeviceId: string,
): Promise<string | null> {
  const devices = await delegationDevices(eventId);
  const page = devices.find(
    (device) =>
      device.kind === "observation_page" &&
      device.cameraLinks.some(
        (link) => link.cameraEdgeDeviceId === cameraEdgeDeviceId,
      ),
  );
  return page?.edgeDeviceId ?? null;
}
