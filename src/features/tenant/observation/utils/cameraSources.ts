import type { EdgeDevice } from "@/server/router";
import type {
  CrowdVideoSource,
  CrowdVideoSourceFactory,
  VideoSourceDescriptor,
} from "./videoSource";

export type ObservationCamera = {
  edgeDeviceId: string;
  name: string;
  observationPointId: string;
};

export type ObservationCameraSelection = {
  page: EdgeDevice | null;
  cameras: ObservationCamera[];
  initialCameraId: string | null;
};

/**
 * 観測ページ自身の cameraLinks から、このページが接続してよいカメラを選ぶ。
 * 本番ではリンクされたカメラだけを対象にし、開発・テストでは ?camera= の
 * 有効なカメラをリンク外でも初期選択として受け付ける。
 */
export function selectObservationCameras(
  devices: EdgeDevice[],
  pageEdgeDeviceId: string,
  requestedCameraId?: string,
  allowUnlinked = process.env.NODE_ENV !== "production",
): ObservationCameraSelection {
  const page = devices.find((d) => d.edgeDeviceId === pageEdgeDeviceId);
  if (page?.kind !== "observation_page") {
    return { page: null, cameras: [], initialCameraId: null };
  }

  const linkByCamera = new Map(
    page.cameraLinks.map((link) => [
      link.cameraEdgeDeviceId,
      link.observationPointId,
    ]),
  );
  const cameras = devices
    .filter(
      (device) =>
        device.kind === "camera" && linkByCamera.has(device.edgeDeviceId),
    )
    .map((device) => ({
      edgeDeviceId: device.edgeDeviceId,
      name: device.name,
      observationPointId: linkByCamera.get(device.edgeDeviceId) ?? "",
    }));

  if (requestedCameraId) {
    const linked = cameras.some(
      (camera) => camera.edgeDeviceId === requestedCameraId,
    );
    if (linked) {
      return { page, cameras, initialCameraId: requestedCameraId };
    }
    const requested = allowUnlinked
      ? devices.find(
          (device) =>
            device.edgeDeviceId === requestedCameraId &&
            device.kind === "camera",
        )
      : undefined;
    if (requested) {
      return {
        page,
        cameras: [
          ...cameras,
          {
            edgeDeviceId: requested.edgeDeviceId,
            name: requested.name,
            observationPointId: "",
          },
        ],
        initialCameraId: requested.edgeDeviceId,
      };
    }
  }

  return {
    page,
    cameras,
    initialCameraId: cameras[0]?.edgeDeviceId ?? null,
  };
}

export type CameraSourceSpec = {
  cameraEdgeId: string;
  createSource: CrowdVideoSourceFactory;
};

export type OpenedCameraSource = {
  cameraEdgeId: string;
  source: CrowdVideoSource;
  descriptor: VideoSourceDescriptor | null;
  error: unknown;
};

/**
 * 全カメラのソースを開く。1台が失敗しても他は開いたままにし、
 * 失敗したソースだけを閉じる。
 */
export async function openCameraSources(
  specs: CameraSourceSpec[],
): Promise<OpenedCameraSource[]> {
  return Promise.all(
    specs.map(async (spec) => {
      const source = spec.createSource();
      try {
        return {
          cameraEdgeId: spec.cameraEdgeId,
          source,
          descriptor: await source.open(),
          error: null,
        };
      } catch (error) {
        source.close();
        return {
          cameraEdgeId: spec.cameraEdgeId,
          source,
          descriptor: null,
          error,
        };
      }
    }),
  );
}
