import { getTranslations } from "next-intl/server";
import { LocaleSelect } from "@/components/locale-select";
import { StaffOnlineBoundary } from "@/components/pwa/staff-online-boundary";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/components/ui/link";
import { managementPath } from "@/features/tenant/management/routes";
import { observationPath } from "@/features/tenant/observation/routes";
import { ConnectedEdges } from "@/features/tenant/webrtc/components/ConnectedEdges";
import { cameraConnectionNotice } from "@/features/tenant/webrtc/utils/cameraConnection";
import { getStaffPwaMetadata } from "@/lib/pwa/staff-manifest";
import { requireStaff } from "@/server/auth";

export function generateMetadata() {
  return getStaffPwaMetadata();
}

export default async function TenantObservationDevices({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
  searchParams: Promise<{ cameraConnection?: string | string[] }>;
}) {
  const { tenantId, eventId } = await params;
  await requireStaff(observationPath(eventId));
  const connectionNotice = cameraConnectionNotice(
    (await searchParams).cameraConnection,
  );
  const t = await getTranslations("ObservationDevices");

  return (
    <StaffOnlineBoundary>
      <div className="flex w-full flex-col">
        <header className="flex w-full items-center justify-between px-10 py-5">
          <h2 className="text-2xl font-bold">{t("title", { tenantId })}</h2>
          <div className="flex items-center gap-2">
            <Link href={managementPath(eventId)} variant="ghost" size="sm">
              {t("managementLink")}
            </Link>
            <LocaleSelect />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex w-full flex-col items-center gap-4 px-10 py-3">
          <ConnectedEdges
            tenantId={tenantId}
            eventId={eventId}
            connectionNotice={connectionNotice}
          />
        </main>
      </div>
    </StaffOnlineBoundary>
  );
}
