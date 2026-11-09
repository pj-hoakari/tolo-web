import { getTranslations } from "next-intl/server";
import { LocaleSelect } from "@/components/locale-select";
import { ThemeToggle } from "@/components/theme-toggle";
import { CreateTenantForm } from "@/features/onboarding/CreateTenantForm";
import { ONBOARDING_ERRORS } from "@/features/onboarding/errorMessages";
import { boundOnboarding } from "@/server/auth";
import { authMockingEnabled } from "@/server/auth/mocking";

export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const t = await getTranslations("Onboarding");
  const { error } = await searchParams;
  const pending = authMockingEnabled() ? undefined : await boundOnboarding();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex w-full items-center justify-between px-10 py-5">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <LocaleSelect />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex w-full flex-1 justify-center px-10 py-5">
        <div className="w-full max-w-md">
          <CreateTenantForm
            pending={
              pending && {
                name: pending.name,
                subdomain: pending.subdomain,
                displayName: pending.displayName,
              }
            }
            error={ONBOARDING_ERRORS.find((known) => known === error)}
          />
        </div>
      </main>
    </div>
  );
}
