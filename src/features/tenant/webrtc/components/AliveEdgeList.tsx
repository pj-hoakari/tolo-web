import type { AliveEdgesStatus } from "../hooks/useAliveEdges";
import type { AliveEdge } from "../type";

export type AliveEdgeListProps = {
  edges: AliveEdge[];
  status: AliveEdgesStatus;
  error: string | null;
  onRefresh: () => void;
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
          {edges.map((edge) => (
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
              <span className="shrink-0 rounded bg-green-100 px-2 py-1 text-green-700 text-xs">
                接続中
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
