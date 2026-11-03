import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { AcceptInvitation } from "@/features/invitation/AcceptInvitation";
import { ACCEPT_ERRORS } from "@/features/invitation/acceptErrors";
import { pendingInvitationToken } from "@/server/auth/invitation";

export default async function InvitationAcceptance({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const t = await getTranslations("Invitation");
  const pending = await pendingInvitationToken();
  const host = (await headers()).get("host") ?? "";
  const { error } = await searchParams;
  const shown = ACCEPT_ERRORS.find((known) => known === error);

  return (
    <AuthScreen title={t("title")}>
      {pending ? (
        <AcceptInvitation host={host} error={shown} />
      ) : (
        <p>{t("notFound")}</p>
      )}
    </AuthScreen>
  );
}
