import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { CHALLENGE_PARAM } from "@/features/auth/idpLogin";
import { LoginForm } from "@/features/auth/LoginForm";
import { SignupOrLogin } from "@/features/auth/SignupOrLogin";
import { loginFlow } from "@/server/auth";
import { authMockingEnabled } from "@/server/auth/mocking";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (authMockingEnabled()) notFound();
  const challenge = (await searchParams)[CHALLENGE_PARAM];
  if (typeof challenge !== "string" || !challenge) {
    redirect("/auth/error?error=no_challenge");
  }
  const login = await loginFlow().challengeLogin(challenge);
  const signup = await loginFlow().signupPending(
    (await headers()).get("cookie") ?? "",
  );
  const t = await getTranslations("Auth");

  return (
    <AuthScreen title={t(signup ? "signup.title" : "login.title")}>
      {signup ? <SignupOrLogin login={login} /> : <LoginForm login={login} />}
    </AuthScreen>
  );
}
