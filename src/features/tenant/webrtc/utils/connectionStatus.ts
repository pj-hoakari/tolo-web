import type { ConnectionStatus } from "../type";

export function isActiveConnection(status: ConnectionStatus): boolean {
  return (
    status === "connecting" ||
    status === "negotiating" ||
    status === "connected"
  );
}
