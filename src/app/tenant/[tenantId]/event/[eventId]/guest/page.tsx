import { getPwaMetadata } from "@/lib/pwa/manifest";
import { GuestPage } from "./_components/GuestPage";

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
  return <GuestPage tenantId={tenantId} eventId={eventId} qrLocationId="" />;
}
