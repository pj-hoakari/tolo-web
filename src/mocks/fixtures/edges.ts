import type { EdgeDeviceItem } from "@/features/tenant/webrtc/type";
import type { EdgeDevice } from "@/server/router";

export const SAMPLE_TENANT_ID = "test";
export const SAMPLE_EVENT_ID = "test";

export const sampleEdgeDevicesWire: EdgeDevice[] = [
  {
    edgeDeviceId: "8c1f0e2a5d4b3c6e",
    name: "入口カメラ",
    online: true,
    lastHeartbeatAt: "2026-06-14T10:00:00.000Z",
    observationPoints: [
      { observationPointId: "a1b2c3d4e5f60718", name: "入口" },
    ],
  },
  {
    edgeDeviceId: "3b9d77f41e2a5c08",
    name: "",
    online: true,
    lastHeartbeatAt: "2026-06-14T10:00:05.000Z",
    observationPoints: [
      { observationPointId: "b2c3d4e5f6071829", name: "ブース前" },
    ],
  },
  {
    edgeDeviceId: "5e6f708192a3b4c5",
    name: "ホールカメラ",
    online: false,
    lastHeartbeatAt: "2026-06-14T09:00:00.000Z",
    observationPoints: [
      { observationPointId: "c3d4e5f60718293a", name: "ホール" },
    ],
  },
];

export const sampleEdgeDeviceItems: EdgeDeviceItem[] =
  sampleEdgeDevicesWire.map((device) => ({
    ...device,
    lastHeartbeatAt: device.lastHeartbeatAt
      ? new Date(device.lastHeartbeatAt)
      : null,
  }));
