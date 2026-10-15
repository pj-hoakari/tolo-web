import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { AliveEdgesStatus } from "../hooks/useAliveEdges";
import type { AliveEdge, ConnectionStatus } from "../type";
import { isActiveConnection } from "../utils/connectionStatus";

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
  const locale = useLocale();
  const t = useTranslations("Webrtc.aliveEdges");
  const tStatus = useTranslations("Webrtc.connectionStatus");

  const formatLastSeen = (lastHeartbeatAt: Date | null): string =>
    lastHeartbeatAt
      ? lastHeartbeatAt.toLocaleTimeString(locale)
      : t("unknownTime");

  return (
    <div className="flex w-full max-w-3xl flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{t("title", { count: edges.length })}</h3>
        <Button
          variant="secondary"
          size="sm"
          onPress={onRefresh}
          isDisabled={loading}
        >
          {t("refresh")}
        </Button>
      </div>
      {status === "error" && error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : edges.length === 0 ? (
        <p className="text-gray-500 text-sm">
          {loading ? t("loading") : t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {edges.map((edge) => {
            const isConnected = edge.edgeDeviceId === connectedEdgeId;
            const isActive = isConnected && isActiveConnection(receiveStatus);

            const canDisconnect = isConnected && receiveStatus !== "idle";
            return (
              <li
                key={edge.edgeDeviceId}
                className="flex items-center justify-between gap-2 rounded border border-gray-200 p-2"
              >
                <div className="flex flex-col">
                  <span className="break-all text-sm">
                    {edge.name || edge.edgeDeviceId}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {t("lastSeen", {
                      time: formatLastSeen(edge.lastHeartbeatAt),
                    })}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isActive && (
                    <span className="text-gray-500 text-xs">
                      {tStatus(receiveStatus)}
                    </span>
                  )}
                  {!isActive && (
                    <Button
                      size="sm"
                      onPress={() => onConnect(edge.edgeDeviceId)}
                    >
                      {t("connect")}
                    </Button>
                  )}
                  {canDisconnect && (
                    <Button variant="outline" size="sm" onPress={onDisconnect}>
                      {t("disconnect")}
                    </Button>
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
