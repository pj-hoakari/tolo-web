import { getTranslations } from "next-intl/server";
import { LocaleSelect } from "@/components/locale-select";
import { PwaInstall } from "@/components/pwa/pwa-install";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/components/ui/link";
import { GraphViewer } from "@/features/tenant/management/graph";
import { graphEditPath } from "@/features/tenant/management/routes";
import { observationPath } from "@/features/tenant/observation/routes";
import { getPwaMetadata } from "@/lib/pwa/manifest";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { eventId } = await params;
  return getPwaMetadata(`/event/${encodeURIComponent(eventId)}/management`);
}

export default async function TenantManagement({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;
  const t = await getTranslations("Management");

  return (
    <div className="flex h-screen flex-col">
      <header className="flex w-full items-center justify-between px-10 py-5">
        <h2 className="text-2xl font-bold">{t("title", { tenantId })}</h2>
        <div className="flex items-center gap-2">
          <Link href={observationPath(eventId)} variant="ghost" size="sm">
            {t("observationDevicesLink")}
          </Link>
          <PwaInstall compact />
          <LocaleSelect />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex min-h-0 w-full flex-1 p-2">
        <div className="w-full overflow-hidden rounded-lg border border-border bg-background">
          <GraphViewer
            tenantId={tenantId}
            eventId={eventId}
            editHref={graphEditPath(eventId)}
          />
        </div>
      </main>
    </div>
  );
}
