import { getTranslations } from "next-intl/server";
import { ManagementHeader } from "@/features/tenant/management/components/ManagementHeader";
import { TenantEvents } from "@/features/tenant/management/events/TenantEvents";
import { getPwaMetadata } from "@/lib/pwa/manifest";

export function generateMetadata() {
  return getPwaMetadata("/management");
}

export default async function TenantEventManagement({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const t = await getTranslations("TenantManagement");

  return (
    <div className="min-h-dvh bg-background">
      <TenantEvents
        tenantId={tenantId}
        header={<ManagementHeader title={t("pageTitle")} tenantId={tenantId} />}
      />
    </div>
  );
}
