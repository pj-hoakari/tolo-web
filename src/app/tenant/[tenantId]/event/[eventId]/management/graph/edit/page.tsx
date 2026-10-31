import { getTranslations } from "next-intl/server";
import { LocaleSelect } from "@/components/locale-select";
import { PwaInstall } from "@/components/pwa/pwa-install";
import { ThemeToggle } from "@/components/theme-toggle";
import { ManagementBackLink } from "@/features/tenant/management/components/ManagementBackLink";
import { GraphEditor } from "@/features/tenant/management/graph";
import { graphEditPath } from "@/features/tenant/management/routes";
import { getPwaMetadata } from "@/lib/pwa/manifest";
import { requireStaff } from "@/server/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { eventId } = await params;
  return getPwaMetadata(
    `/event/${encodeURIComponent(eventId)}/management/graph/edit`,
  );
}

export default async function TenantGraphEdit({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;
  await requireStaff(graphEditPath(eventId));
  const t = await getTranslations("Management");

  return (
    <div className="flex h-screen flex-col">
      <header className="flex w-full items-center justify-between gap-4 px-10 py-5">
        <h2 className="truncate text-2xl font-bold">
          {t("graphEditTitle", { tenantId })}
        </h2>
        <div className="flex items-center gap-2">
          <PwaInstall compact />
          <LocaleSelect />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex min-h-0 w-full flex-1 flex-col items-start gap-1 px-2 pb-2">
        <div className="h-fit w-full flex-none">
          <ManagementBackLink eventId={eventId} />
        </div>
        <div className="w-full grow overflow-hidden rounded-lg border border-border bg-background">
          <GraphEditor tenantId={tenantId} eventId={eventId} />
        </div>
      </main>
    </div>
  );
}
