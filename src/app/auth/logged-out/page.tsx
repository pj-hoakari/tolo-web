import { getTranslations } from "next-intl/server";
import { Link } from "@/components/ui/link";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { tenantOrigin } from "@/lib/control/tenant";
import { sameHostPath } from "@/server/auth/login";

export default async function LoggedOut({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  const { state } = await searchParams;
  const value = typeof state === "string" ? state : undefined;
  const machineReturn = value ? parseMachineReturn(value) : undefined;
  const origin = value ? tenantOrigin(value) : undefined;
  const t = await getTranslations("Auth.loggedOut");

  return (
    <AuthScreen title={t("title")}>
      {machineReturn ? (
        <Link href={machineReturn} variant="default">
          {t("toObservation")}
        </Link>
      ) : (
        origin && (
          <Link href={`${origin}/management`} variant="default">
            {t("login")}
          </Link>
        )
      )}
    </AuthScreen>
  );
}

function parseMachineReturn(state: string): string | undefined {
  try {
    const parsed = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8"),
    ) as { host?: unknown; returnPath?: unknown };
    if (
      typeof parsed.host !== "string" ||
      typeof parsed.returnPath !== "string"
    ) {
      return undefined;
    }
    const origin = tenantOrigin(parsed.host);
    const path = sameHostPath(parsed.returnPath);
    return origin && path ? `${origin}${path}` : undefined;
  } catch {
    return undefined;
  }
}
