"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { JollyTextField } from "@/components/ui/textfield";
import {
  type ChallengeLogin,
  type SignupInputError,
  signupInputError,
  submitSignup,
} from "./idpLogin";

type State =
  | {
      status: "editing";
      error: SignupInputError | "usernameTaken" | "failed" | null;
    }
  | { status: "submitting" };

export function SignupForm({ login }: { login: ChallengeLogin }) {
  const t = useTranslations("Auth.signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State>({ status: "editing", error: null });
  const submitting = state.status === "submitting";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const invalid = signupInputError(username, password);
    if (invalid) {
      setState({ status: "editing", error: invalid });
      return;
    }
    setState({ status: "submitting" });
    const result = await submitSignup(login, username, password);
    if (result === "accepted") {
      location.assign(login.resumeUrl);
      return;
    }
    setState({ status: "editing", error: result });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <JollyTextField
        label={t("usernameLabel")}
        description={t("usernameDescription")}
        name="username"
        autoComplete="username"
        value={username}
        onChange={setUsername}
        isDisabled={submitting}
      />
      <JollyTextField
        label={t("passwordLabel")}
        description={t("passwordDescription")}
        name="password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        isDisabled={submitting}
      />
      {state.status === "editing" && state.error && (
        <p role="alert" className="text-sm text-destructive">
          {t(state.error)}
        </p>
      )}
      <Button
        type="submit"
        className="self-start"
        isDisabled={submitting || !username || !password}
      >
        {t("submit")}
      </Button>
    </form>
  );
}
