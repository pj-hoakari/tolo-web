import { ORPCError } from "@orpc/client";
import type { EdgeDeviceItem } from "../type";

export type CameraConnectionAuthorizationError = {
  code: "CONNECTION_AUTHORIZATION_REQUIRED";
  viewerType: "staff" | "machine" | null;
  eventId: string | null;
  pageEdgeDeviceId: string | null;
  cameraEdgeDeviceId: string | null;
};

export type CameraNotDelegatedError = {
  code: "CAMERA_NOT_DELEGATED";
  viewerType: "staff" | "machine" | null;
  eventId: string | null;
  pageEdgeDeviceId: string | null;
  cameraEdgeDeviceId: string | null;
};

export type CameraConnectionError =
  | CameraConnectionAuthorizationError
  | CameraNotDelegatedError;

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

function errorString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * BFF の接続エラーから、自動再認可に必要な情報だけを取り出す。
 * トークンなどは含めない。
 */
export function cameraConnectionError(
  cause: unknown,
): CameraConnectionError | null {
  if (!(cause instanceof ORPCError)) return null;
  const data = cause.data as
    | {
        code?: unknown;
        viewerType?: unknown;
        eventId?: unknown;
        pageEdgeDeviceId?: unknown;
        cameraEdgeDeviceId?: unknown;
      }
    | undefined;
  if (
    data?.code !== "CONNECTION_AUTHORIZATION_REQUIRED" &&
    data?.code !== "CAMERA_NOT_DELEGATED"
  ) {
    return null;
  }
  return {
    code: data.code,
    viewerType:
      data.viewerType === "staff" || data.viewerType === "machine"
        ? data.viewerType
        : null,
    eventId: errorString(data.eventId),
    pageEdgeDeviceId: errorString(data.pageEdgeDeviceId),
    cameraEdgeDeviceId: errorString(data.cameraEdgeDeviceId),
  };
}

const CAMERA_CONNECTION_AUTO_START_PREFIX = "tolo:cameraConnectionAutoStart";

type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function cameraConnectionAutoStartKey(
  eventId: string,
  pageEdgeDeviceId: string,
): string {
  return `${CAMERA_CONNECTION_AUTO_START_PREFIX}:${eventId}:${pageEdgeDeviceId}`;
}

/**
 * 接続認可の自動開始を一度だけ行う。sessionStorage のキーで同じページからの
 * 連続リダイレクトを防ぎ、成功した接続でキーを消して次の期限切れに備える。
 */
export function startCameraConnectionAuthorization({
  eventId,
  pageEdgeDeviceId,
  returnPath,
  storage = typeof window === "undefined" ? undefined : window.sessionStorage,
  navigate = (path: string) => window.location.assign(path),
}: {
  eventId: string;
  pageEdgeDeviceId: string;
  returnPath: string;
  storage?: SessionStorage;
  navigate?: (path: string) => void;
}): boolean {
  const key = cameraConnectionAutoStartKey(eventId, pageEdgeDeviceId);
  try {
    const stored = storage?.getItem(key);
    if (stored !== undefined && stored !== null) {
      return false;
    }
    storage?.setItem(key, new Date().toISOString());
  } catch {
    // sessionStorage が使えなくても、このページ表示中の再試行は避ける。
  }
  navigate(cameraConnectionPath({ eventId, pageEdgeDeviceId, returnPath }));
  return true;
}

export function clearCameraConnectionAutoStart({
  eventId,
  pageEdgeDeviceId,
  storage = typeof window === "undefined" ? undefined : window.sessionStorage,
}: {
  eventId: string;
  pageEdgeDeviceId: string;
  storage?: SessionStorage;
}): void {
  try {
    storage?.removeItem(
      cameraConnectionAutoStartKey(eventId, pageEdgeDeviceId),
    );
  } catch {
    // 消せなくても自動開始が止まるだけで、接続自体には影響しない。
  }
}

export function machineSessionPath({
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
  return `/api/auth/machine/start?${query}`;
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
