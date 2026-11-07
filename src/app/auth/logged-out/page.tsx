import { redirect } from "next/navigation";
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
  const machineReturn =
    typeof state === "string" ? parseMachineReturn(state) : undefined;
  if (machineReturn) redirect(machineReturn);
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

function parseMachineReturn(state: string): string | undefined {
  try {
    const parsed = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8"),
    ) as { host?: unknown; returnPath?: unknown };
    if (
      typeof parsed.host !== "string" ||
      typeof parsed.returnPath !== "string"
    )
      return undefined;
    const origin = tenantOrigin(parsed.host);
    const path = sameHostPath(parsed.returnPath);
    return origin && path ? `${origin}${path}` : undefined;
  } catch {
    return undefined;
  }
}
