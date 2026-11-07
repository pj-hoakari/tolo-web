import type { EdgeDeviceItem } from "../type";

export function pageForCamera(
  edges: EdgeDeviceItem[],
  cameraEdgeDeviceId: string,
): EdgeDeviceItem | undefined {
  return edges.find(
    (edge) =>
      edge.kind === "observation_page" &&
      edge.cameraLinks.some(
        (link) => link.cameraEdgeDeviceId === cameraEdgeDeviceId,
      ),
  );
}

export function pageForObservationPoint(
  edges: EdgeDeviceItem[],
  observationPointId: string,
): EdgeDeviceItem | undefined {
  return edges.find(
    (edge) =>
      edge.kind === "observation_page" &&
      edge.observationPoints.some(
        (point) => point.observationPointId === observationPointId,
      ),
  );
}

export function cameraConnectionPath({
  eventId,
  pageEdgeDeviceId,
  returnPath,
}: {
  eventId: string;
  pageEdgeDeviceId: string;
  returnPath: string;
}): string {
  const query = new URLSearchParams({
    eventId,
    pageEdgeDeviceId,
    return: returnPath,
  });
  return `/api/auth/connection/start?${query}`;
}

export type CameraConnectionNotice = "authorized" | "login_required" | "failed";

export function cameraConnectionNotice(
  value: string | string[] | undefined,
): CameraConnectionNotice | null {
  return value === "authorized" ||
    value === "login_required" ||
    value === "failed"
    ? value
    : null;
}
