import { GuestPage } from "../_components/GuestPage";

export { generateMetadata } from "../page";

export default async function TenantGuestFromQr({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string; qrLocationId: string }>;
}) {
  const { tenantId, eventId, qrLocationId } = await params;
  return (
    <GuestPage
      tenantId={tenantId}
      eventId={eventId}
      qrLocationId={decodeURIComponent(qrLocationId)}
    />
  );
}
