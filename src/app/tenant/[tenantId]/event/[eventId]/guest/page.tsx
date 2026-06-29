import { LanguageProvider } from "@/features/guest/i18n/LanguageProvider";
import CallingNumber from "@/features/guest/info/CallingNumber";
import Congestion from "@/features/guest/info/Congestion";
import EstimatedWaitTime from "@/features/guest/info/EstimatedWaitTime";
import Floor from "@/features/guest/info/Floor";
import GuideMap from "@/features/guest/info/GuideMap";
import QueueLayout from "@/features/guest/info/QueueLayout";
import type { GuestInfoComponent } from "@/features/guest/info/type";
import WaitingNumber from "@/features/guest/info/WaitingNumber";
import { GuestHeader } from "./_components/GuestHeader";
import { GuestInfoContainer } from "./_components/GuestInfoContainer";

export default async function TenantGuest({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;

  // TODO: Fetch tenant details using tenantId
  const tenantName = tenantId;

  // 各コンポーネントが自身の span（col-span-1 / col-span-2）を宣言
  // フラットな配列で並び順だけを指定
  const infoComponents: GuestInfoComponent[] = [
    GuideMap,
    Floor,
    CallingNumber,
    EstimatedWaitTime,
    WaitingNumber,
    QueueLayout,
    Congestion,
  ];

  return (
    <LanguageProvider>
      <div className="min-h-full guest-glow">
        <GuestHeader
          tenantName={tenantName}
          tenantId={tenantId}
          eventId={eventId}
        />
        <main className="mx-auto w-full max-w-md px-4 py-6">
          <GuestInfoContainer
            tenantId={tenantId}
            eventId={eventId}
            components={infoComponents}
          />
        </main>
      </div>
    </LanguageProvider>
  );
}
