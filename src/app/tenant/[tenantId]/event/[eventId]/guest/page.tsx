import "@/features/guest/guest-theme.css";
import GraphCompassGuide from "@/features/guest/info/GraphCompassGuide";
import GuideMap from "@/features/guest/info/GuideMap";
import type { GuestInfoComponent } from "@/features/guest/info/type";
import { getPwaMetadata } from "@/lib/pwa/manifest";
import { GuestHeader } from "./_components/GuestHeader";
import { GuestInfoContainer } from "./_components/GuestInfoContainer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { eventId } = await params;
  return getPwaMetadata(`/event/${encodeURIComponent(eventId)}/guest`);
}

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
  const infoComponents: GuestInfoComponent[] = [GraphCompassGuide, GuideMap];

  return (
    <div className="guest-theme guest-glow min-h-full">
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
  );
}
