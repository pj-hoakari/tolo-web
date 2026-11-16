import { getTranslations } from "next-intl/server";
import { StaffOnlineBoundary } from "@/components/pwa/staff-online-boundary";
import { ManagementHeader } from "@/features/tenant/management/components/ManagementHeader";
import { TenantEvents } from "@/features/tenant/management/events/TenantEvents";
import { getStaffPwaMetadata } from "@/lib/pwa/staff-manifest";

import { requireStaff } from "@/server/auth";

export function generateMetadata() {
  return getStaffPwaMetadata();
}

export default async function TenantEventManagement({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  await requireStaff("/management");
  const { tenantId } = await params;
  const t = await getTranslations("TenantManagement");

  return (
    <StaffOnlineBoundary>
      <div className="min-h-dvh bg-background">
        <TenantEvents
          tenantId={tenantId}
          header={
            <ManagementHeader title={t("pageTitle")} tenantId={tenantId} />
          }
        />
      </div>
    </StaffOnlineBoundary>
  );
}
