import { getTranslations } from "next-intl/server";
import { LocaleSelect } from "@/components/locale-select";
import { PwaInstall } from "@/components/pwa/pwa-install";
import { ThemeToggle } from "@/components/theme-toggle";
import { TenantEvents } from "@/features/tenant/management/events/TenantEvents";
import { getPwaMetadata } from "@/lib/pwa/manifest";
import { requireStaff } from "@/server/auth";

export function generateMetadata() {
  return getPwaMetadata("/management");
}

export default async function TenantEventManagement({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  await requireStaff("/management");
  const { tenantId } = await params;
  const t = await getTranslations("TenantManagement");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex w-full items-center justify-between px-10 py-5">
        <h2 className="text-2xl font-bold">{t("title", { tenantId })}</h2>
        <div className="flex items-center gap-2">
          <PwaInstall compact />
          <LocaleSelect />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex w-full flex-1 justify-center px-10 py-5">
        <TenantEvents tenantId={tenantId} />
      </main>
    </div>
  );
}
