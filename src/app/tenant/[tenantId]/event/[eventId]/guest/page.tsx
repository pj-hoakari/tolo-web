import { LanguageProvider } from "@/features/guest/i18n/LanguageProvider";
import CallingNumber from "@/features/guest/info/CallingNumber";
import EstimatedWaitTime from "@/features/guest/info/EstimatedWaitTime";
import QueueLayout from "@/features/guest/info/QueueLayout";
import WaitingNumber from "@/features/guest/info/WaitingNumber";
import { GuestHeader } from "./_components/GuestHeader";
import {
  GuestInfoContainer,
  type GuestInfoRow,
} from "./_components/GuestInfoContainer";

export default async function TenantGuest({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;

  // TODO: Fetch tenant details using tenantId
  const tenantName = tenantId;

  const infoRows: GuestInfoRow[] = [
    QueueLayout,
    CallingNumber,
    [EstimatedWaitTime, WaitingNumber],
  ];

  return (
    <LanguageProvider>
      <div className="min-h-full bg-canvas">
        <GuestHeader
          tenantName={tenantName}
          tenantId={tenantId}
          eventId={eventId}
        />
        <main className="mx-auto w-full max-w-md px-4 py-6">
          <GuestInfoContainer
            tenantId={tenantId}
            eventId={eventId}
            rows={infoRows}
          />
        </main>
      </div>
    </LanguageProvider>
  );
}
