import { useTranslations } from "next-intl";
import { LocaleSelect } from "@/components/locale-select";
import { PwaInstall } from "@/components/pwa/pwa-install";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/components/ui/link";
import { LogoutButton } from "@/features/auth/LogoutButton";

export function ManagementHeader({
  title,
  tenantId,
}: {
  title: string;
  tenantId: string;
}) {
  const t = useTranslations("Management");
  const tTenant = useTranslations("TenantManagement");

  return (
    <header className="sticky top-0 z-10 shrink-0 border-b border-border bg-background px-4 py-4 sm:px-6">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 basis-48">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="min-w-0 text-lg font-semibold tracking-tight break-words">
              {title}
            </h1>
          </div>
          <div className="mt-1 text-xs text-muted-foreground lg:hidden">
            <p className="break-all">{t("tenantId", { id: tenantId })}</p>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 [&_svg]:size-4">
          <Link href="/management/members" variant="ghost" size="sm">
            {tTenant("membersLink")}
          </Link>
          <PwaInstall compact />
          <LocaleSelect />
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
