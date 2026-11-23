import { getTranslations } from "next-intl/server";
import { Link } from "@/components/ui/link";
import { ManagementControls } from "./ManagementControls";
import { ManagementHomeTitle } from "./ManagementHomeTitle";
import { ManagementBanner, ManagementNavigation } from "./ManagementShell";

export async function ManagementHeader({
  tenantId,
  staff,
  members,
  logout,
}: {
  tenantId: string;
  staff: boolean;
  members: boolean;
  logout: boolean;
}) {
  const [t, tManagement] = await Promise.all([
    getTranslations("TenantManagement"),
    getTranslations("Management"),
  ]);
  const title = t("pageTitle");
  return (
    <ManagementBanner className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-border bg-background px-4 py-4 sm:px-6">
      <div className="flex min-w-0 flex-1 basis-48 flex-col items-start gap-2">
        <ManagementHomeTitle title={title} tenantId={tenantId} staff={staff} />
        <p className="text-xs wrap-anywhere text-muted-foreground lg:hidden">
          {tManagement("tenantId", { id: tenantId })}
        </p>
      </div>
      <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2 [&_svg]:size-4">
        {members && (
          <ManagementNavigation aria-label={title}>
            <Link href="/management/members" variant="ghost" size="sm">
              {t("membersLink")}
            </Link>
          </ManagementNavigation>
        )}
        <ManagementControls install logout={logout} />
      </div>
    </ManagementBanner>
  );
}
