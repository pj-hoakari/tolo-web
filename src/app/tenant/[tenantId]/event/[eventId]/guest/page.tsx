import CallingNumber from "@/features/guest/info/CallingNumber";
import EstimatedWaitTime from "@/features/guest/info/EstimatedWaitTime";
import type { GuestInfoComponent } from "@/features/guest/info/type";
import WaitingNumber from "@/features/guest/info/WaitingNumber";
import { GuestInfoContainer } from "./_components/GuestInfoContainer";

export default async function TenantGuest({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;

  // TODO: Fetch tenant details using tenantId
  const tenantName = tenantId;

  const infoComponents: GuestInfoComponent[] = [
    WaitingNumber,
    CallingNumber,
    EstimatedWaitTime,
  ];

  return (
    <div className="flex flex-col">
      <header className="mb-4 w-full">
        <h2 className="text-2xl font-bold px-10 py-5">
          {tenantName} ゲストページ
        </h2>
      </header>
      <main className="w-full">
        <GuestInfoContainer
          tenantId={tenantId}
          eventId={eventId}
          components={infoComponents}
        />
      </main>
    </div>
  );
}
