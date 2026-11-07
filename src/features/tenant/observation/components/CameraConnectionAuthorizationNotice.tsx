"use client";

import { useTranslations } from "next-intl";
import type { CameraConnectionAuthorizationError } from "@/features/tenant/webrtc/utils/cameraConnection";
import { useCameraConnectionAuthorization } from "../hooks/useCameraConnectionAuthorization";

export function CameraConnectionAuthorizationNotice({
  error,
  eventId,
  pageEdgeDeviceId,
}: {
  error: CameraConnectionAuthorizationError | null;
  eventId: string;
  pageEdgeDeviceId: string;
}) {
  const t = useTranslations("Observation.errors");
  const { autoStartBlocked } = useCameraConnectionAuthorization({
    error,
    eventId,
    pageEdgeDeviceId,
  });

  if (error?.code !== "CONNECTION_AUTHORIZATION_REQUIRED") {
    return null;
  }

  const text =
    error.viewerType === "staff" && !autoStartBlocked
      ? t("connectionAuthorizationAutoStart")
      : t("connectionAuthorizationMachine");

  return (
    <p role="alert" className="text-destructive">
      {text}
    </p>
  );
}
