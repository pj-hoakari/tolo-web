import { getTranslations } from "next-intl/server";
import { LocaleSelect } from "@/components/locale-select";
import { ThemeToggle } from "@/components/theme-toggle";
import { CreateTenantForm } from "@/features/onboarding/CreateTenantForm";

export default async function Onboarding() {
  const t = await getTranslations("Onboarding");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex w-full items-center justify-between px-10 py-5">
        <h1 className="font-bold text-2xl">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <LocaleSelect />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex w-full flex-1 justify-center px-10 py-5">
        <div className="w-full max-w-md">
          <CreateTenantForm />
        </div>
      </main>
    </div>
  );
}
