"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { JollyTextField } from "@/components/ui/textfield";
import { type ChallengeLogin, submitCredentials } from "./idpLogin";

type State =
  | { status: "editing"; error: "invalidCredentials" | "failed" | null }
  | { status: "submitting" };

export function LoginForm({ login }: { login: ChallengeLogin }) {
  const t = useTranslations("Auth.login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State>({ status: "editing", error: null });
  const submitting = state.status === "submitting";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ status: "submitting" });
    const result = await submitCredentials(login, username, password);
    if (result === "accepted") {
      location.assign(login.resumeUrl);
      return;
    }
    if (result === "invalidCredentials") setPassword("");
    setState({ status: "editing", error: result });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <JollyTextField
        label={t("usernameLabel")}
        name="username"
        autoComplete="username"
        value={username}
        onChange={setUsername}
        isDisabled={submitting}
      />
      <JollyTextField
        label={t("passwordLabel")}
        name="password"
        type="password"
        autoComplete="current-password"
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
