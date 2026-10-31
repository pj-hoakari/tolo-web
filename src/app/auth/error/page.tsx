import { getTranslations } from "next-intl/server";
import { Link } from "@/components/ui/link";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { tenantOrigin } from "@/lib/control/tenant";

export default async function LoginError({
  searchParams,
}: {
  searchParams: Promise<{ host?: string | string[] }>;
}) {
  const { host } = await searchParams;
  const origin = typeof host === "string" ? tenantOrigin(host) : undefined;
  const t = await getTranslations("Auth.error");

  return (
    <AuthScreen title={t("title")}>
      {origin ? (
        <Link href={`${origin}/management`} variant="default">
          {t("retry")}
        </Link>
      ) : (
        <p>{t("reopen")}</p>
      )}
    </AuthScreen>
  );
}
