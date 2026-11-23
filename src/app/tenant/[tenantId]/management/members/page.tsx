import { getTranslations } from "next-intl/server";
import { LocaleSelect } from "@/components/locale-select";
import { StaffOnlineBoundary } from "@/components/pwa/staff-online-boundary";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/components/ui/link";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { TenantMembers } from "@/features/tenant/management/members/TenantMembers";
import { requireStaff } from "@/server/auth";

export default async function TenantMemberManagement({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  await requireStaff("/management/members");
  const { tenantId } = await params;
  const t = await getTranslations("TenantMembers");

  return (
    <StaffOnlineBoundary>
      <div className="flex min-h-screen flex-col">
        <header className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-10">
          <h2 className="text-2xl font-bold">{t("title", { tenantId })}</h2>
          <div className="flex items-center gap-2">
            <Link href="/management" variant="ghost" size="sm">
              {t("eventsLink")}
            </Link>
            <LocaleSelect />
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>
        <main className="flex w-full flex-1 justify-center px-4 py-5 sm:px-10">
          <TenantMembers tenantId={tenantId} />
        </main>
      </div>
    </StaffOnlineBoundary>
  );
}
