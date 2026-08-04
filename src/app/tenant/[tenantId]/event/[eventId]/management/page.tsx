import { getTranslations } from "next-intl/server";
import { LocaleSelect } from "@/components/locale-select";
import { ThemeToggle } from "@/components/theme-toggle";
import { ManagementTabs } from "@/features/tenant/management/components/ManagementTabs";

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
