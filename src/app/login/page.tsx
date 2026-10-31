import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { CHALLENGE_PARAM } from "@/features/auth/idpLogin";
import { LoginForm } from "@/features/auth/LoginForm";
import { loginFlow } from "@/server/auth";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const challenge = (await searchParams)[CHALLENGE_PARAM];
  if (typeof challenge !== "string" || !challenge) {
    redirect("/auth/error?error=no_challenge");
  }
  const login = await loginFlow().challengeLogin(challenge);
  const t = await getTranslations("Auth.login");

  return (
    <AuthScreen title={t("title")}>
      <LoginForm login={login} />
    </AuthScreen>
  );
}
