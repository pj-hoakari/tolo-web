import { LocaleSelect } from "@/components/locale-select";
import { ThemeToggle } from "@/components/theme-toggle";
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
        <header className="mb-4 flex w-full items-center justify-between px-10 py-5">
          <h2 className="font-bold text-2xl">{tenantId} 観測ページ</h2>
          <div className="flex items-center gap-2">
            <LocaleSelect />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex w-full flex-col items-center gap-4">
          <ScreenWakeControl />
          <CrowdDetection tenantId={tenantId} eventId={eventId} />
        </main>
      </div>
    </ScreenWakeProvider>
  );
}
