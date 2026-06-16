import { ConnectedEdges } from "@/features/tenant/webrtc/components/ConnectedEdges";

export default async function TenantManagement({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;

  return (
    <div className="flex flex-col">
      <header className="mb-4 w-full">
        <h2 className="px-10 py-5 font-bold text-2xl">{tenantId} 管理ページ</h2>
      </header>
      <main className="flex w-full flex-col items-center gap-4">
        <ConnectedEdges tenantId={tenantId} eventId={eventId} />
      </main>
    </div>
  );
}
