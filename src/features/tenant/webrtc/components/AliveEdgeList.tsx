import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { EdgeDevicesStatus } from "../hooks/useEdgeDevices";
import type { ConnectionStatus, EdgeDeviceItem } from "../type";
import { isActiveConnection } from "../utils/connectionStatus";

export type AliveEdgeListProps = {
  edges: EdgeDeviceItem[];
  status: EdgeDevicesStatus;
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
        <h3 className="font-semibold text-lg">
          {t("title", { count: edges.length })}
        </h3>
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
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : edges.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {loading ? t("loading") : t("empty")}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {edges.map((edge) => {
            const isConnected = edge.edgeDeviceId === connectedEdgeId;
            const isActive = isConnected && isActiveConnection(receiveStatus);

            const showStatus = isConnected && receiveStatus !== "idle";
            const name = edge.name || edge.edgeDeviceId;
            return (
              <li
                key={edge.edgeDeviceId}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="break-all font-medium">{name}</span>
                  <span className="text-muted-foreground text-xs">
                    {t("lastSeen", {
                      time: formatLastSeen(edge.lastHeartbeatAt),
                    })}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!edge.online && (
                    <span className="rounded-full border px-2 py-0.5 text-muted-foreground text-xs">
                      {t("offline")}
                    </span>
                  )}
                  {showStatus && (
                    <span className="rounded-full border px-2 py-0.5 text-muted-foreground text-xs">
                      {tStatus(receiveStatus)}
                    </span>
                  )}
                  {!isActive && (
                    <Button
                      size="sm"
                      onPress={() => onConnect(edge.edgeDeviceId)}
                      isDisabled={!edge.online}
                      aria-label={t("connectLabel", { name })}
                    >
                      {t("connect")}
                    </Button>
                  )}
                  {isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={onDisconnect}
                      aria-label={t("disconnectLabel", { name })}
                    >
                      {t("disconnect")}
                    </Button>
                  )}
                  {showStatus && !isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={onDisconnect}
                      aria-label={t("closeLabel", { name })}
                    >
                      {t("close")}
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
