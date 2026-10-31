import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { AcceptInvitation } from "@/features/invitation/AcceptInvitation";
import { pendingInvitationToken } from "@/server/auth/invitation";

export default async function InvitationAcceptance() {
  const t = await getTranslations("Invitation");
  const pending = await pendingInvitationToken();
  const host = (await headers()).get("host") ?? "";

  return (
    <AuthScreen title={t("title")}>
      {pending ? <AcceptInvitation host={host} /> : <p>{t("notFound")}</p>}
    </AuthScreen>
  );
}
