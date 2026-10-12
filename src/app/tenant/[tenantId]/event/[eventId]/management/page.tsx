import { getTranslations } from "next-intl/server";
import { LocaleSelect } from "@/components/locale-select";
import { PwaInstall } from "@/components/pwa/pwa-install";
import { ThemeToggle } from "@/components/theme-toggle";
import { ManagementTabs } from "@/features/tenant/management/components/ManagementTabs";
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
        <h2 className="font-bold text-2xl">{t("title", { tenantId })}</h2>
        <div className="flex items-center gap-2">
          <PwaInstall compact />
          <LocaleSelect />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex min-h-0 w-full flex-1">
        <ManagementTabs tenantId={tenantId} eventId={eventId} />
      </main>
    </div>
  );
}
