import { getTranslations } from "next-intl/server";
import {
  GuideMapStudio,
  GuideMapStudioTitle,
  guideMapEditPath,
} from "@/features/guide-map-studio";
import { ManagementBackLink } from "@/features/tenant/management/components/ManagementBackLink";
import { ManagementNavigation } from "@/features/tenant/management/components/ManagementShell";
import { getPwaMetadata } from "@/lib/pwa/manifest";
import { requireStaff } from "@/server/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { eventId } = await params;
  return getPwaMetadata(
    `/event/${encodeURIComponent(eventId)}/management/guide-map/edit`,
  );
}

export default async function TenantGuideMapEdit({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { eventId } = await params;
  await requireStaff(guideMapEditPath(eventId));
  const t = await getTranslations("Management");

  return (
    <div data-management-canvas className="min-h-0">
      <GuideMapStudio
        eventId={eventId}
        leading={
          <>
            <ManagementNavigation aria-label={t("backLink")}>
              <ManagementBackLink eventId={eventId} />
            </ManagementNavigation>
            <h2 className="min-w-0 truncate text-sm font-semibold">
              <GuideMapStudioTitle />
            </h2>
          </>
        }
      />
    </div>
  );
}
