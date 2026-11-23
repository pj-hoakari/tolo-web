import { getTranslations } from "next-intl/server";
import { ManagementPageHeading } from "@/features/tenant/management/components/ManagementPageHeading";
import { ManagementMain } from "@/features/tenant/management/components/ManagementShell";
import { TenantMembers } from "@/features/tenant/management/members/TenantMembers";
import { requireStaff } from "@/server/auth";

export default async function TenantMemberManagement({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  await requireStaff("/management/members");
  const { tenantId } = await params;
  const t = await getTranslations("TenantMembers");

  return (
    <div className="flex min-h-0 flex-col">
      <ManagementPageHeading title={t("title", { tenantId })} />
      <ManagementMain className="flex w-full justify-center px-4 py-5 sm:px-10">
        <TenantMembers tenantId={tenantId} />
      </ManagementMain>
    </div>
  );
}
