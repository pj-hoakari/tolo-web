import { getTranslations } from "next-intl/server";
import { LocaleSelect } from "@/components/locale-select";
import { PwaInstall } from "@/components/pwa/pwa-install";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/components/ui/link";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { CrowdDetection } from "@/features/tenant/observation/components/CrowdDetection";
import { ObservationSoftLock } from "@/features/tenant/observation/components/ObservationSoftLock";
import { ScreenWakeControl } from "@/features/tenant/observation/components/ScreenWakeControl";
import { ScreenWakeProvider } from "@/features/tenant/observation/components/ScreenWakeProvider";
import { observationDevicePath } from "@/features/tenant/observation/routes";
import { machineSessionPath } from "@/features/tenant/webrtc/utils/cameraConnection";
import { getPwaMetadata } from "@/lib/pwa/manifest";
import { getViewer } from "@/server/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string; edgeDeviceId: string }>;
}) {
  const { eventId, edgeDeviceId } = await params;
  return getPwaMetadata(
    observationDevicePath(
      encodeURIComponent(eventId),
      encodeURIComponent(edgeDeviceId),
    ),
  );
}

export default async function TenantObservation({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string; eventId: string; edgeDeviceId: string }>;
  searchParams: Promise<{
    camera?: string | string[];
    machineSession?: string | string[];
  }>;
}) {
  const { tenantId, eventId, edgeDeviceId } = await params;
  const query = await searchParams;
  const requestedCamera = query.camera;
  const machineFailed =
    query.machineSession === "failed" ||
    query.machineSession === "login_required";
  const requestedCameraId =
    typeof requestedCamera === "string" &&
    /^[0-9a-f]{16}$/.test(requestedCamera)
      ? requestedCamera
      : undefined;
  const t = await getTranslations("Observation");
  const viewer = await getViewer();
  const canReport =
    (viewer.type === "machine" &&
      viewer.eventId === eventId &&
      viewer.edgeDeviceId === edgeDeviceId) ||
    process.env.NEXT_PUBLIC_API_MOCKING === "enabled";

  return (
    <ScreenWakeProvider>
      <ObservationSoftLock tenantId={tenantId} eventId={eventId}>
        <div className="flex w-full flex-col">
          <header className="mb-4 flex w-full items-center justify-between px-10 py-5">
            <h2 className="text-2xl font-bold">{t("title", { tenantId })}</h2>
            <div className="flex items-center gap-2">
              <PwaInstall compact />
              <LocaleSelect />
              <ThemeToggle />
              <LogoutButton />
            </div>
          </header>
          <main className="flex w-full flex-col items-center gap-4">
            {machineFailed && (
              <div role="alert" className="flex flex-col items-center gap-2">
                <p>{t("machineSessionFailed")}</p>
                <Link
                  href={machineSessionPath({
                    eventId,
                    pageEdgeDeviceId: edgeDeviceId,
                    returnPath: observationDevicePath(eventId, edgeDeviceId),
                  })}
                  variant="outline"
                >
                  {t("machineSessionRetry")}
                </Link>
              </div>
            )}
            <ScreenWakeControl />
            {viewer.type === "staff" && !machineFailed && (
              <Link
                variant="default"
                href={machineSessionPath({
                  eventId,
                  pageEdgeDeviceId: edgeDeviceId,
                  returnPath: observationDevicePath(eventId, edgeDeviceId),
                })}
              >
                {t("controls.observeOnThisDevice")}
              </Link>
            )}
            <CrowdDetection
              canReport={canReport}
              tenantId={tenantId}
              eventId={eventId}
              edgeDeviceId={edgeDeviceId}
              requestedCameraId={requestedCameraId}
            />
          </main>
        </div>
      </ObservationSoftLock>
    </ScreenWakeProvider>
  );
}
