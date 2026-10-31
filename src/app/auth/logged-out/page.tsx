import { getTranslations } from "next-intl/server";
import { Link } from "@/components/ui/link";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { tenantOrigin } from "@/lib/control/tenant";

export default async function LoggedOut({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  const { state } = await searchParams;
  const origin = typeof state === "string" ? tenantOrigin(state) : undefined;
  const t = await getTranslations("Auth.loggedOut");

  return (
    <AuthScreen title={t("title")}>
      {origin && (
        <Link href={`${origin}/management`} variant="default">
          {t("login")}
        </Link>
      )}
    </AuthScreen>
  );
}
