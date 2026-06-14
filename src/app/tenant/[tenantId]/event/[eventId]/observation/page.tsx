import { CrowdDetection } from "@/features/tenant/observation/components/CrowdDetection";

export default async function TenantObservation({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;

  return (
    <div className="flex flex-col">
      <header className="mb-4 w-full">
        <h2 className="px-10 py-5 font-bold text-2xl">{tenantId} 観測ページ</h2>
      </header>
      <main className="w-full">
        <CrowdDetection tenantId={tenantId} eventId={eventId} />
      </main>
    </div>
  );
}
