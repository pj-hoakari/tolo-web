import { getTranslations } from "next-intl/server";
import { ManagementBackLink } from "@/features/tenant/management/components/ManagementBackLink";
import { ManagementPageHeading } from "@/features/tenant/management/components/ManagementPageHeading";
import { ManagementMain } from "@/features/tenant/management/components/ManagementShell";
import { GraphEditor } from "@/features/tenant/management/graph";
import { graphEditPath } from "@/features/tenant/management/routes";
import { getPwaMetadata } from "@/lib/pwa/manifest";
import { requireStaff } from "@/server/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { eventId } = await params;
  return getPwaMetadata(
    `/event/${encodeURIComponent(eventId)}/management/graph/edit`,
  );
}

export default async function TenantGraphEdit({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;
  await requireStaff(graphEditPath(eventId));
  const t = await getTranslations("Management");

  return (
    <div data-management-canvas className="flex min-h-0 flex-col">
      <ManagementPageHeading
        title={t("graphEditTitle", { tenantId })}
        navigation={<ManagementBackLink eventId={eventId} />}
        className="py-1"
      />
      <ManagementMain className="flex min-h-0 w-full flex-1 flex-col items-start gap-1 px-2 pb-2">
        <div className="w-full grow overflow-hidden rounded-lg border border-border bg-background">
          <GraphEditor tenantId={tenantId} eventId={eventId} />
        </div>
      </ManagementMain>
    </div>
  );
}
