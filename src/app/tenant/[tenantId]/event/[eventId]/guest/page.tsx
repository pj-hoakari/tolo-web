import { LanguageProvider } from "@/features/guest/i18n/LanguageProvider";
import CallingNumber from "@/features/guest/info/CallingNumber";
import Congestion from "@/features/guest/info/Congestion";
import EstimatedWaitTime from "@/features/guest/info/EstimatedWaitTime";
import Floor from "@/features/guest/info/Floor";
import GuideMap from "@/features/guest/info/GuideMap";
import QueueLayout from "@/features/guest/info/QueueLayout";
import WaitingNumber from "@/features/guest/info/WaitingNumber";
import { GuestHeader } from "./_components/GuestHeader";
import {
  type GuestInfoTile,
  ReorderableGuestInfoContainer,
} from "./_components/ReorderableGuestInfoContainer";

export default async function TenantGuest({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;

  // TODO: Fetch tenant details using tenantId
  const tenantName = tenantId;

  // モジュールを 1 つ 1 つ独立したタイルとして定義する。
  // span: full は 2 列ぶち抜き、half は 1 列（横に 2 つ並ぶ）。
  // モジュールの Symbol id はサーバー/クライアント境界で失われるため、id は明示する。
  const tiles: GuestInfoTile[] = [
    {
      id: "guide-map",
      span: "full",
      node: <GuideMap tenantId={tenantId} eventId={eventId} />,
    },
    {
      id: "floor",
      span: "half",
      node: <Floor tenantId={tenantId} eventId={eventId} />,
    },
    {
      id: "calling-number",
      span: "half",
      node: <CallingNumber tenantId={tenantId} eventId={eventId} />,
    },
    {
      id: "estimated-wait-time",
      span: "half",
      node: <EstimatedWaitTime tenantId={tenantId} eventId={eventId} />,
    },
    {
      id: "waiting-number",
      span: "half",
      node: <WaitingNumber tenantId={tenantId} eventId={eventId} />,
    },
    {
      id: "queue-layout",
      span: "full",
      node: <QueueLayout tenantId={tenantId} eventId={eventId} />,
    },
    {
      id: "congestion",
      span: "full",
      node: <Congestion tenantId={tenantId} eventId={eventId} />,
    },
  ];

  return (
    <LanguageProvider>
      <div className="min-h-full bg-guest-canvas">
        <GuestHeader
          tenantName={tenantName}
          tenantId={tenantId}
          eventId={eventId}
        />
        <main className="mx-auto w-full max-w-md px-4 py-6">
          <ReorderableGuestInfoContainer tiles={tiles} />
        </main>
      </div>
    </LanguageProvider>
  );
}
