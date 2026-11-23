import { getTranslations } from "next-intl/server";
import { Link } from "@/components/ui/link";
import { ManagementPageHeading } from "@/features/tenant/management/components/ManagementPageHeading";
import { ManagementMain } from "@/features/tenant/management/components/ManagementShell";
import { getEventNavigationAccess } from "@/features/tenant/management/events/navigationAccess";
import { managementPath } from "@/features/tenant/management/routes";
import { observationPath } from "@/features/tenant/observation/routes";
import { ConnectedEdges } from "@/features/tenant/webrtc/components/ConnectedEdges";
import { cameraConnectionNotice } from "@/features/tenant/webrtc/utils/cameraConnection";
import { getPwaMetadata } from "@/lib/pwa/manifest";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { eventId } = await params;
  return getPwaMetadata(observationPath(encodeURIComponent(eventId)));
}

export default async function TenantObservationDevices({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
  searchParams: Promise<{ cameraConnection?: string | string[] }>;
}) {
  const { tenantId, eventId } = await params;
  const connectionNotice = cameraConnectionNotice(
    (await searchParams).cameraConnection,
  );
  const [t, access] = await Promise.all([
    getTranslations("ObservationDevices"),
    getEventNavigationAccess(eventId),
  ]);

  return (
    <div className="flex w-full flex-col">
      <ManagementPageHeading
        title={t("title", { tenantId })}
        navigation={
          access.canViewObservationDevices ? (
            <Link href={managementPath(eventId)} variant="ghost" size="sm">
              {t("managementLink")}
            </Link>
          ) : undefined
        }
      />
      <ManagementMain className="flex w-full flex-col items-center gap-4 px-4 py-3 sm:px-10">
        <ConnectedEdges
          tenantId={tenantId}
          eventId={eventId}
          connectionNotice={connectionNotice}
        />
      </ManagementMain>
    </div>
  );
}
