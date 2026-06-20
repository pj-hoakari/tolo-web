import { ManagementTabs } from "@/features/tenant/management/components/ManagementTabs";

export default async function TenantManagement({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <header className="w-full">
        <h2 className="px-10 py-5 font-bold text-2xl">{tenantId} 管理ページ</h2>
      </header>
      <main className="flex w-full min-h-0 flex-1">
        <ManagementTabs tenantId={tenantId} eventId={eventId} />
      </main>
    </div>
  );
}
