import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { FlowStateNotes } from "@/features/flowState/FlowStateNotes";
import type { FlowElementState } from "@/features/flowState/type";
import { observationDevicePath } from "@/features/tenant/observation/routes";
import type { EdgeDevicesStatus } from "../hooks/useEdgeDevices";
import type { ConnectionStatus, EdgeDeviceItem } from "../type";
import {
  type CameraConnectionNotice,
  cameraConnectionPath,
  pageForCamera,
} from "../utils/cameraConnection";
import { isActiveConnection } from "../utils/connectionStatus";
import { CameraProvisioningDialog } from "./CameraProvisioningDialog";
import { StopCameraDialog } from "./StopCameraDialog";
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
  connectionReturnPath?: string;
  connectionNotice?: CameraConnectionNotice | null;
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
  connectionReturnPath,
  connectionNotice,
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

  const observationPointNames = new Map<string, string>();
  const hasCameraWithPage = edges.some(
    (edge) => edge.kind === "camera" && pageForCamera(edges, edge.edgeDeviceId),
  );
  for (const edge of edges) {
    if (edge.kind !== "observation_page") continue;
    for (const point of edge.observationPoints) {
      observationPointNames.set(point.observationPointId, point.name);
    }
  }

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
      {hasCameraWithPage && (
        <p className="text-sm text-muted-foreground">
          {t("cameraConnectionHint")}
        </p>
      )}
      {connectionNotice && (
        <p
          role={connectionNotice === "authorized" ? "status" : "alert"}
          className={
            connectionNotice === "authorized"
              ? "text-sm text-muted-foreground"
              : "text-sm text-destructive"
          }
        >
          {t(`connection.${connectionNotice}`)}
        </p>
      )}
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
            const isCamera = edge.kind === "camera";
            const isConnected = edge.edgeDeviceId === connectedEdgeId;
            const isActive = isConnected && isActiveConnection(receiveStatus);

            const showStatus =
              !isCamera && isConnected && receiveStatus !== "idle";
            const name = edge.name || edge.edgeDeviceId;
            const linkedPointNames = isCamera
              ? edge.cameraLinks
                  .map((link) =>
                    observationPointNames.get(link.observationPointId),
                  )
                  .filter((label): label is string => Boolean(label))
              : [];
            const owningPage = isCamera
              ? pageForCamera(edges, edge.edgeDeviceId)
              : undefined;
            return (
              <li
                key={edge.edgeDeviceId}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="flex items-center gap-2">
                    {isCamera && (
                      <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                        {t("cameraBadge")}
                      </span>
                    )}
                    <span className="font-medium break-all">{name}</span>
                  </span>
                  {isCamera ? (
                    linkedPointNames.length > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {t("linkedPoint", {
                          name: linkedPointNames.join(", "),
                        })}
                      </span>
                    ) : null
                  ) : (
                    <>
                      {edge.observationPoints.length > 0 ? (
                        <fieldset
                          aria-label={t("observationPoints")}
                          className="mt-1 flex flex-col gap-1 text-sm"
                        >
                          {edge.observationPoints.map((point) => (
                            <div key={point.observationPointId}>
                              {point.name}
                              <FlowStateNotes
                                state={flowStates?.get(
                                  point.observationPointId,
                                )}
                                className="text-xs"
                              />
                            </div>
                          ))}
                        </fieldset>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {t("lastSeen", {
                          time: formatLastSeen(edge.lastHeartbeatAt),
                        })}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {!isCamera && !edge.online && (
                    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                      {t("offline")}
                    </span>
                  )}
                  {showStatus && (
                    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                      {tStatus(receiveStatus)}
                    </span>
                  )}
                  {!isCamera && !isActive && (
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
                  {!isCamera && !edge.online && (
                    <Link
                      href={observationDevicePath(eventId, edge.edgeDeviceId)}
                      variant="secondary"
                      size="sm"
                      aria-label={t("openHereLabel", { name })}
                    >
                      {t("openHere")}
                    </Link>
                  )}
                  {isCamera && owningPage && (
                    <Link
                      href={cameraConnectionPath({
                        eventId,
                        pageEdgeDeviceId: owningPage.edgeDeviceId,
                        returnPath: connectionReturnPath ?? "/",
                      })}
                      variant="outline"
                      size="sm"
                      aria-label={t("authorizeConnectionLabel", { name })}
                    >
                      {t("authorizeConnection")}
                    </Link>
                  )}
                  {isCamera && (
                    <>
                      <CameraProvisioningDialog
                        eventId={eventId}
                        edgeDeviceId={edge.edgeDeviceId}
                        edgeName={name}
                        triggerLabel={t("provision")}
                        triggerAriaLabel={t("provisionLabel", { name })}
                      />
                      <CameraProvisioningDialog
                        eventId={eventId}
                        edgeDeviceId={edge.edgeDeviceId}
                        edgeName={name}
                        triggerLabel={t("reapprove")}
                        triggerAriaLabel={t("reapproveLabel", { name })}
                        reapproval
                      />
                      <StopCameraDialog
                        eventId={eventId}
                        edgeDeviceId={edge.edgeDeviceId}
                        name={name}
                        onStopped={onUnregistered}
                      />
                    </>
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
