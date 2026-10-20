import { getTranslations } from "next-intl/server";
import { LocaleSelect } from "@/components/locale-select";
import { PwaInstall } from "@/components/pwa/pwa-install";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/components/ui/link";
import { managementPath } from "@/features/tenant/management/routes";
import { CrowdDetection } from "@/features/tenant/observation/components/CrowdDetection";
import { ObservationSoftLock } from "@/features/tenant/observation/components/ObservationSoftLock";
import { ScreenWakeControl } from "@/features/tenant/observation/components/ScreenWakeControl";
import { ScreenWakeProvider } from "@/features/tenant/observation/components/ScreenWakeProvider";
import { getPwaMetadata } from "@/lib/pwa/manifest";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string; edgeDeviceId?: string }>;
}) {
  const { eventId, edgeDeviceId } = await params;
  const devicePath = edgeDeviceId ? `/${encodeURIComponent(edgeDeviceId)}` : "";
  return getPwaMetadata(
    `/event/${encodeURIComponent(eventId)}/observation${devicePath}`,
  );
}

export default async function TenantObservation({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string; edgeDeviceId?: string }>;
}) {
  const { tenantId, eventId, edgeDeviceId } = await params;
  const t = await getTranslations("Observation");

  return (
    <ScreenWakeProvider>
      <ObservationSoftLock tenantId={tenantId} eventId={eventId}>
        <div className="flex w-full flex-col">
          <header className="mb-4 flex w-full items-center justify-between px-10 py-5">
            <h2 className="font-bold text-2xl">{t("title", { tenantId })}</h2>
            <div className="flex items-center gap-2">
              <PwaInstall compact />
              <LocaleSelect />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex w-full flex-col items-center gap-4">
            <ScreenWakeControl />
            {!edgeDeviceId && (
              <p className="w-full max-w-3xl rounded-md border px-4 py-3 text-sm">
                {t("missingEdgeDevice.message")}{" "}
                <Link
                  href={managementPath(eventId)}
                  className="underline underline-offset-4"
                >
                  {t("missingEdgeDevice.link")}
                </Link>
              </p>
            )}
            <CrowdDetection
              tenantId={tenantId}
              eventId={eventId}
              edgeDeviceId={edgeDeviceId}
            />
          </main>
        </div>
      </ObservationSoftLock>
    </ScreenWakeProvider>
  );
}
