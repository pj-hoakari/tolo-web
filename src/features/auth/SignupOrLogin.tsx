"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ChallengeLogin } from "./idpLogin";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";

export function SignupOrLogin({ login }: { login: ChallengeLogin }) {
  const t = useTranslations("Auth.signup");
  const [signup, setSignup] = useState(true);

  return (
    <>
      <p>{signup ? t("description") : t("loginDescription")}</p>
      {signup ? <SignupForm login={login} /> : <LoginForm login={login} />}
      <Button
        variant="link"
        className="px-0"
        onPress={() => setSignup(!signup)}
      >
        {signup ? t("useExistingAccount") : t("createAccount")}
      </Button>
    </>
  );
}
