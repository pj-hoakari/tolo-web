import { useTranslations } from "next-intl";
import { Link } from "@/components/ui/link";

export default function Home() {
  const t = useTranslations("HomePage");
  return (
    <main className="flex flex-1 items-center justify-center">
      <Link href="/onboarding" variant="default" size="lg">
        {t("createTenant")}
      </Link>
    </main>
  );
}
