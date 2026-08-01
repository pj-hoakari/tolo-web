import { ThemeToggle } from "@/components/theme-toggle";
import { ManagementBackLink } from "@/features/tenant/management/components/ManagementBackLink";
import { GraphEditor } from "@/features/tenant/management/graph";

export default async function TenantGraphEdit({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex w-full items-center justify-between gap-4 px-10 py-5">
        <h2 className="truncate font-bold text-2xl">
          {tenantId} 会場グラフ編集
        </h2>
        <ThemeToggle />
      </header>
      <main className="flex min-h-0 w-full flex-1 flex-col items-start gap-1 px-2 pb-2">
        <div className="h-fit w-full flex-none">
          <ManagementBackLink eventId={eventId} />
        </div>
        <div className="w-full grow overflow-hidden rounded-lg border border-border bg-background">
          <GraphEditor />
        </div>
      </main>
    </div>
  );
}
