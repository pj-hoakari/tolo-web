import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { FlowStateNotes } from "@/features/flowState/FlowStateNotes";
import type { FlowElementState } from "@/features/flowState/type";
import { observationDevicePath } from "@/features/tenant/observation/routes";
import type { EdgeDevicesStatus } from "../hooks/useEdgeDevices";
import type { ConnectionStatus, EdgeDeviceItem } from "../type";
import { isActiveConnection } from "../utils/connectionStatus";
import { UnregisterEdgeDeviceDialog } from "./UnregisterEdgeDeviceDialog";

export type AliveEdgeListProps = {
  eventId: string;
  edges: EdgeDeviceItem[];
  status: EdgeDevicesStatus;
  error: string | null;
  onRefresh: () => void;
  flowStates?: ReadonlyMap<string, FlowElementState>;
  flowStatesFailed?: boolean;
  connectedEdgeId: string | null;
  receiveStatus: ConnectionStatus;
  onConnect: (edgeId: string) => void;
  onDisconnect: () => void;
  onUnregistered: () => void;
};

export function AliveEdgeList({
  eventId,
  edges,
  status,
  error,
  onRefresh,
  flowStates,
  flowStatesFailed,
  connectedEdgeId,
  receiveStatus,
  onConnect,
  onDisconnect,
  onUnregistered,
}: AliveEdgeListProps) {
  const loading = status === "loading";
  const locale = useLocale();
  const t = useTranslations("Webrtc.aliveEdges");
  const tStatus = useTranslations("Webrtc.connectionStatus");
  const tFlow = useTranslations("FlowState");

  const formatLastSeen = (lastHeartbeatAt: Date | null): string =>
    lastHeartbeatAt
      ? lastHeartbeatAt.toLocaleTimeString(locale)
      : t("unknownTime");

  return (
    <div className="flex w-full max-w-3xl flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
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
      {flowStatesFailed ? (
        <p className="text-sm text-destructive">{tFlow("error")}</p>
      ) : null}
      {status === "error" && error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : edges.length === 0 ? (
        <p className="text-sm text-muted-foreground">
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
                  <span className="font-medium break-all">{name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("lastSeen", {
                      time: formatLastSeen(edge.lastHeartbeatAt),
                    })}
                  </span>
                  {edge.observationPoints.length > 0 ? (
                    <fieldset
                      aria-label={t("observationPoints")}
                      className="mt-1 flex flex-col gap-1 text-sm"
                    >
                      {edge.observationPoints.map((point) => (
                        <div key={point.observationPointId}>
                          {point.name}
                          <FlowStateNotes
                            state={flowStates?.get(point.observationPointId)}
                            className="text-xs"
                          />
                        </div>
                      ))}
                    </fieldset>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {!edge.online && (
                    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                      {t("offline")}
                    </span>
                  )}
                  {showStatus && (
                    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
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
                  {!edge.online && (
                    <Link
                      href={observationDevicePath(eventId, edge.edgeDeviceId)}
                      variant="secondary"
                      size="sm"
                      aria-label={t("openHereLabel", { name })}
                    >
                      {t("openHere")}
                    </Link>
                  )}
                  <UnregisterEdgeDeviceDialog
                    eventId={eventId}
                    edgeDeviceId={edge.edgeDeviceId}
                    name={name}
                    onUnregistered={onUnregistered}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
