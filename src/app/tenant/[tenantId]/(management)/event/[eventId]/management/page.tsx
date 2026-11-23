import { getTranslations } from "next-intl/server";
import { Link } from "@/components/ui/link";
import { guideMapEditPath } from "@/features/guide-map-studio/routes";
import { ManagementPageHeading } from "@/features/tenant/management/components/ManagementPageHeading";
import { ManagementMain } from "@/features/tenant/management/components/ManagementShell";
import { GraphViewer } from "@/features/tenant/management/graph";
import { readStaffEventNavigationAccess } from "@/features/tenant/management/headerAccess";
import {
  graphEditPath,
  managementPath,
} from "@/features/tenant/management/routes";
import { ObservationSettingsSection } from "@/features/tenant/management/settings/ObservationSettingsSection";
import { observationPath } from "@/features/tenant/observation/routes";
import { getPwaMetadata } from "@/lib/pwa/manifest";
import { requireStaff } from "@/server/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { eventId } = await params;
  return getPwaMetadata(`/event/${encodeURIComponent(eventId)}/management`);
}

export default async function TenantManagement({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;
  await requireStaff(managementPath(eventId));
  const [t, access] = await Promise.all([
    getTranslations("Management"),
    readStaffEventNavigationAccess(eventId),
  ]);

  return (
    <div data-management-canvas className="flex min-h-0 flex-col">
      <ManagementPageHeading
        title={t("title", { tenantId })}
        navigation={
          access.canViewObservationDevices ? (
            <>
              {access.canEditGuideMap && (
                <Link
                  href={guideMapEditPath(eventId)}
                  variant="ghost"
                  size="sm"
                >
                  {t("guideMapEditLink")}
                </Link>
              )}
              <Link href={observationPath(eventId)} variant="ghost" size="sm">
                {t("observationDevicesLink")}
              </Link>
            </>
          ) : undefined
        }
      />
      <ManagementMain className="flex min-h-0 w-full flex-1 flex-col gap-2 p-2">
        <ObservationSettingsSection key={eventId} eventId={eventId} />
        <div className="min-h-0 w-full flex-1 overflow-hidden rounded-lg border border-border bg-background">
          <GraphViewer
            tenantId={tenantId}
            eventId={eventId}
            editHref={graphEditPath(eventId)}
          />
        </div>
      </ManagementMain>
    </div>
  );
}
