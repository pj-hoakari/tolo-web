import { ThemeToggle } from "@/components/theme-toggle";
import { ManagementTabs } from "@/features/tenant/management/components/ManagementTabs";

export default async function TenantManagement({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex w-full items-center justify-between px-10 py-5">
        <h2 className="font-bold text-2xl">{tenantId} 管理ページ</h2>
        <ThemeToggle />
      </header>
      <main className="flex min-h-0 w-full flex-1">
        <ManagementTabs tenantId={tenantId} eventId={eventId} />
      </main>
    </div>
  );
}
