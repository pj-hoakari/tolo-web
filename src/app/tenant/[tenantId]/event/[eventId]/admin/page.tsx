import { EdgeCameraMonitor } from "@/features/tenant/webrtc/components/EdgeCameraMonitor";

export default async function TenantEventAdmin({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;

  return <EdgeCameraMonitor tenantId={tenantId} eventId={eventId} />;
}
