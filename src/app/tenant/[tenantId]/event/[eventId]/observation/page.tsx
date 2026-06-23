import { CrowdDetection } from "@/features/tenant/observation/components/CrowdDetection";
import { ScreenWakeControl } from "@/features/tenant/observation/components/ScreenWakeControl";
import { ScreenWakeProvider } from "@/features/tenant/observation/components/ScreenWakeProvider";

export default async function TenantObservation({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;

  return (
    <ScreenWakeProvider>
      <div className="flex flex-col">
        <header className="mb-4 w-full">
          <h2 className="px-10 py-5 font-bold text-2xl">
            {tenantId} 観測ページ
          </h2>
        </header>
        <main className="flex w-full flex-col items-center gap-4">
          <ScreenWakeControl />
          <CrowdDetection tenantId={tenantId} eventId={eventId} />
        </main>
      </div>
    </ScreenWakeProvider>
  );
}
