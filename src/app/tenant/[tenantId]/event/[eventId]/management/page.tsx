import { getTranslations } from "next-intl/server";
import { LocaleSelect } from "@/components/locale-select";
import { StaffOnlineBoundary } from "@/components/pwa/staff-online-boundary";
import { StaffPwaInstall } from "@/components/pwa/staff-pwa-install";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/components/ui/link";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { EventListBackLink } from "@/features/tenant/management/events/EventListBackLink";
import { GraphViewer } from "@/features/tenant/management/graph";
import {
  graphEditPath,
  managementPath,
} from "@/features/tenant/management/routes";
import { ObservationSettingsSection } from "@/features/tenant/management/settings/ObservationSettingsSection";
import { observationPath } from "@/features/tenant/observation/routes";
import { getStaffPwaMetadata } from "@/lib/pwa/staff-manifest";
import { requireStaff } from "@/server/auth";

export function generateMetadata() {
  return getStaffPwaMetadata();
}

export default async function TenantManagement({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;
  await requireStaff(managementPath(eventId));
  const t = await getTranslations("Management");

  return (
    <StaffOnlineBoundary>
      <div className="flex h-screen flex-col">
        <header className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-10">
          <div className="flex min-w-0 flex-col gap-2">
            <EventListBackLink tenantId={tenantId} />
            <h2 className="text-2xl font-bold">{t("title", { tenantId })}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Link href={observationPath(eventId)} variant="ghost" size="sm">
              {t("observationDevicesLink")}
            </Link>
            <StaffPwaInstall compact />
            <LocaleSelect />
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>
        <main className="flex min-h-0 w-full flex-1 flex-col gap-2 p-2">
          <ObservationSettingsSection key={eventId} eventId={eventId} />
          <div className="min-h-0 w-full flex-1 overflow-hidden rounded-lg border border-border bg-background">
            <GraphViewer
              tenantId={tenantId}
              eventId={eventId}
              editHref={graphEditPath(eventId)}
            />
          </div>
        </main>
      </div>
    </StaffOnlineBoundary>
  );
}
