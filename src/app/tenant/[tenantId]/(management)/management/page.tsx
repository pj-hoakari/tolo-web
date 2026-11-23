import { TenantEvents } from "@/features/tenant/management/events/TenantEvents";
import { getPwaMetadata } from "@/lib/pwa/manifest";

import { requireStaff } from "@/server/auth";

export function generateMetadata() {
  return getPwaMetadata("/management");
}

export default async function TenantEventManagement({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  await requireStaff("/management");
  const { tenantId } = await params;
  return <TenantEvents tenantId={tenantId} />;
}
