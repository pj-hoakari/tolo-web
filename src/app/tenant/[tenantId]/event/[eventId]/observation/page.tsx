import { getTranslations } from "next-intl/server";
import { LocaleSelect } from "@/components/locale-select";
import { PwaInstall } from "@/components/pwa/pwa-install";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/components/ui/link";
import { managementPath } from "@/features/tenant/management/routes";
import { observationPath } from "@/features/tenant/observation/routes";
import { ConnectedEdges } from "@/features/tenant/webrtc/components/ConnectedEdges";
import { getPwaMetadata } from "@/lib/pwa/manifest";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { eventId } = await params;
  return getPwaMetadata(observationPath(encodeURIComponent(eventId)));
}

export default async function TenantObservationDevices({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;
  const t = await getTranslations("ObservationDevices");

  return (
    <div className="flex w-full flex-col">
      <header className="flex w-full items-center justify-between px-10 py-5">
        <h2 className="text-2xl font-bold">{t("title", { tenantId })}</h2>
        <div className="flex items-center gap-2">
          <Link href={managementPath(eventId)} variant="ghost" size="sm">
            {t("managementLink")}
          </Link>
          <PwaInstall compact />
          <LocaleSelect />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex w-full flex-col items-center gap-4 px-10 py-3">
        <ConnectedEdges tenantId={tenantId} eventId={eventId} />
      </main>
    </div>
  );
}
