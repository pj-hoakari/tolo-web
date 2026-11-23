import type { ReactNode } from "react";
import { ManagementHeader } from "@/features/tenant/management/components/ManagementHeader";
import { ManagementShell } from "@/features/tenant/management/components/ManagementShell";
import { canReadTenantMembers } from "@/features/tenant/management/headerAccess";
import { getViewer } from "@/server/auth";

export default async function ManagementLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const [{ tenantId }, viewer] = await Promise.all([params, getViewer()]);
  const staff = viewer.type === "staff";
  const members = staff && (await canReadTenantMembers());

  return (
    <ManagementShell
      header={
        <ManagementHeader
          tenantId={tenantId}
          staff={staff}
          members={members}
          logout={viewer.type !== "anonymous"}
        />
      }
    >
      {children}
    </ManagementShell>
  );
}
