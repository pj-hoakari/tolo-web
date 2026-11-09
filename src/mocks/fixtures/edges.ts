import type { EdgeDeviceItem } from "@/features/tenant/webrtc/type";
import type {
  EdgeDevice,
  EdgeDeviceKind,
  RegisteredEdgeDevice,
} from "@/server/router";

export const SAMPLE_TENANT_ID = "test";
export const SAMPLE_EVENT_ID = "test";

export const sampleCameraDeviceWire: EdgeDevice = {
  edgeDeviceId: "d4e5f60718293a4b",
  name: "ESP32 カメラ",
  kind: "camera",
  cameraLinks: [
    {
      cameraEdgeDeviceId: "d4e5f60718293a4b",
      observationPointId: "a1b2c3d4e5f60718",
    },
  ],
  online: null,
  lastHeartbeatAt: null,
  observationPoints: [],
};

export const sampleSecondCameraDeviceWire: EdgeDevice = {
  edgeDeviceId: "7a8b9c0d1e2f3041",
  name: "ESP32 カメラ 2",
  kind: "camera",
  cameraLinks: [
    {
      cameraEdgeDeviceId: "7a8b9c0d1e2f3041",
      observationPointId: "f1e2d3c4b5a69788",
    },
  ],
  online: null,
  lastHeartbeatAt: null,
  observationPoints: [],
};

export const sampleEdgeDevicesWire: EdgeDevice[] = [
  {
    edgeDeviceId: "8c1f0e2a5d4b3c6e",
    name: "入口カメラ",
    kind: "observation_page",
    cameraLinks: [],
    online: true,
    lastHeartbeatAt: "2026-06-14T10:00:00.000Z",
    observationPoints: [
      { observationPointId: "a1b2c3d4e5f60718", name: "入口" },
      { observationPointId: "f1e2d3c4b5a69788", name: "出口" },
    ],
  },
  {
    edgeDeviceId: "3b9d77f41e2a5c08",
    name: "",
    kind: "observation_page",
    cameraLinks: [],
    online: true,
    lastHeartbeatAt: "2026-06-14T10:00:05.000Z",
    observationPoints: [
      { observationPointId: "b2c3d4e5f6071829", name: "ブース前" },
    ],
  },
  {
    edgeDeviceId: "5e6f708192a3b4c5",
    name: "ホールカメラ",
    kind: "observation_page",
    cameraLinks: [],
    online: false,
    lastHeartbeatAt: "2026-06-14T09:00:00.000Z",
    observationPoints: [
      { observationPointId: "c3d4e5f60718293a", name: "ホール" },
    ],
  },
];

const randomPublicId = () =>
  crypto.randomUUID().replaceAll("-", "").slice(0, 16);

export function registeredEdgeDeviceWire({
  eventId,
  name,
  kind = "observation_page",
  observationPointNames,
  linkedObservationPointId,
}: {
  eventId: string;
  name: string;
  kind?: EdgeDeviceKind;
  observationPointNames: string[];
  linkedObservationPointId?: string;
}): RegisteredEdgeDevice {
  const edgeDeviceId = randomPublicId();
  if (kind === "camera") {
    return {
      device: {
        edgeDeviceId,
        name,
        kind,
        cameraLinks: linkedObservationPointId
          ? [
              {
                cameraEdgeDeviceId: edgeDeviceId,
                observationPointId: linkedObservationPointId,
              },
            ]
          : [],
        online: null,
        lastHeartbeatAt: null,
        observationPoints: [],
      },
      observationPagePath: "",
    };
  }
  return {
    device: {
      edgeDeviceId,
      name,
      kind,
      cameraLinks: [],
      online: false,
      lastHeartbeatAt: null,
      observationPoints: observationPointNames.map((pointName) => ({
        observationPointId: randomPublicId(),
        name: pointName,
      })),
    },
    observationPagePath: `/event/${eventId}/observation/${edgeDeviceId}`,
  };
}

/**
 * 観測ページが委任されたカメラを含む、モック用のエッジ端末一覧。
 * ページ自身の cameraLinks に sampleCameraDeviceWire と
 * sampleSecondCameraDeviceWire が入る。
 */
const sampleObservationCameras = [
  sampleCameraDeviceWire,
  sampleSecondCameraDeviceWire,
];

export const sampleObservationDevicesWire: EdgeDevice[] = [
  {
    ...sampleEdgeDevicesWire[0],
    cameraLinks: sampleObservationCameras.map((camera) => ({
      cameraEdgeDeviceId: camera.edgeDeviceId,
      observationPointId: camera.cameraLinks[0].observationPointId,
    })),
  },
  ...sampleEdgeDevicesWire.slice(1),
  ...sampleObservationCameras,
];

export const sampleEdgeDeviceItems: EdgeDeviceItem[] =
  sampleObservationDevicesWire.map((device) => ({
    ...device,
    lastHeartbeatAt: device.lastHeartbeatAt
      ? new Date(device.lastHeartbeatAt)
      : null,
  }));
