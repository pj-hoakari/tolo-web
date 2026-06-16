import type { ConnectionStatus } from "../type";

export const CONNECTION_STATUS_LABEL: Record<ConnectionStatus, string> = {
  idle: "未接続",
  connecting: "接続要求中…",
  negotiating: "ネゴシエーション中…",
  connected: "接続済み",
  disconnected: "切断",
  error: "接続失敗",
};

export function isActiveConnection(status: ConnectionStatus): boolean {
  return (
    status === "connecting" ||
    status === "negotiating" ||
    status === "connected"
  );
}
