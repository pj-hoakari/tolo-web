import type { ObservationPoint } from "@/server/router";

/** ListEdgeDevices で取得したエッジ端末 */
export type EdgeDeviceItem = {
  edgeDeviceId: string;
  name: string;
  online: boolean;
  // Heartbeat を一度も受けていなければ null
  lastHeartbeatAt: Date | null;
  observationPoints: ObservationPoint[];
};

/** management側の接続状態。 */
export type ConnectionStatus =
  | "idle" // 未接続
  | "connecting" // セッション確立中（requestConnection）
  | "negotiating" // SDP/ICE 交換中
  | "connected" // P2P 接続確立
  | "disconnected" // 切断・接続失敗
  | "error"; // 要求エラー
