import type { AliveEdgesStatus } from "../hooks/useAliveEdges";
import type { AliveEdge, ConnectionStatus } from "../type";
import {
  CONNECTION_STATUS_LABEL,
  isActiveConnection,
} from "../utils/connectionStatus";

export type AliveEdgeListProps = {
  edges: AliveEdge[];
  status: AliveEdgesStatus;
  error: string | null;
  onRefresh: () => void;
  connectedEdgeId: string | null;
  receiveStatus: ConnectionStatus;
  onConnect: (edgeId: string) => void;
  onDisconnect: () => void;
};

function formatLastSeen(lastSeenAt: Date | null): string {
  if (!lastSeenAt) {
    return "不明";
  }
  return lastSeenAt.toLocaleTimeString("ja-JP");
}

export function AliveEdgeList({
  edges,
  status,
  error,
  onRefresh,
  connectedEdgeId,
  receiveStatus,
  onConnect,
  onDisconnect,
}: AliveEdgeListProps) {
  const loading = status === "loading";

  return (
    <div className="flex w-full max-w-3xl flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">接続中のエッジ（{edges.length}）</h3>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded bg-gray-200 px-3 py-1 text-sm disabled:opacity-50"
        >
          更新
        </button>
      </div>
      {status === "error" && error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : edges.length === 0 ? (
        <p className="text-gray-500 text-sm">
          {loading ? "読み込み中…" : "接続中のエッジがありません"}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {edges.map((edge) => {
            const isConnected = edge.id === connectedEdgeId;
            const isActive = isConnected && isActiveConnection(receiveStatus);

            const canDisconnect = isConnected && receiveStatus !== "idle";
            return (
              <li
                key={edge.id}
                className="flex items-center justify-between gap-2 rounded border border-gray-200 p-2"
              >
                <div className="flex flex-col">
                  <span className="break-all text-sm">{edge.id}</span>
                  <span className="text-gray-500 text-xs">
                    最終応答: {formatLastSeen(edge.lastSeenAt)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isActive && (
                    <span className="text-gray-500 text-xs">
                      {CONNECTION_STATUS_LABEL[receiveStatus]}
                    </span>
                  )}
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => onConnect(edge.id)}
                      className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
                    >
                      接続
                    </button>
                  )}
                  {canDisconnect && (
                    <button
                      type="button"
                      onClick={onDisconnect}
                      className="rounded bg-gray-600 px-3 py-1 text-sm text-white"
                    >
                      切断
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
